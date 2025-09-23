import axios from "axios";
import pool from "../config/db.js";

import { QuestionPrompt } from "../utils/prompts.js";
import scraperService from "../services/scrapperServices.js";
import aiContentService from "../services/aiContentServices.js";

import { generateContentHash, normalizeContent } from "../utils/hash.js";
import { generateEmbedding, cosineSimilarity } from "../utils/embeddings.js";


// import { text } from "body-parser";

export const getTopicsByID = async (req, res) => {
    try {
        const { courseId } = req.params;

        // Validate courseId
        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required",
            });
        }

        const query = `
            SELECT
                t.topic_id,
                t.topic_title,
                t.topic_description,
                t.is_completed,
                c.language_id
            FROM topics t
            INNER JOIN 
                courses c
            ON
                t.course_id = c.course_id
            WHERE
                c.course_id = ?
            ORDER BY
                t.order_index ASC
        `;

        const [rows] = await pool.execute(query, [courseId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Topics not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Topics Fetched successfully",
            data: {
                topics: rows,
                total: rows.length,
            },
        });
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching courses',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
};


export const markAsCompleted = async (req, res) => {

    const { topicId } = req.params;
    const { is_completed } = req.body;

    try {
        if (!topicId) {
            return res.status(400).json({
                success: false,
                message: "topicId is required",
            });
        }


        const query = `
            UPDATE topics
            SET is_completed = ?
            WHERE topic_id = ?
        `;

        const [rows] = await pool.execute(query, [is_completed ? 1 : 0, topicId]);

        if (rows.affectedRows === 0) {
            return res.status(404).json({
                message: "Topic not found",
                success: false,
            });
        }

        res.status(200).json({
            success: true,
            message: `Topic ${is_completed === 1 ? "marked as completed" : "reset to incomplete"} successfully`,
        });
    } catch (error) {
        console.error("Error marking topic as completed: ", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error while marking topic as completed",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }

};

export const resetCourseProgress = async(req, res) => {
    const { courseId } = req.params;
    try {
        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "courseId is required",
            });
        }

        const query = `
            UPDATE topics
            SET is_completed = 0
            WHERE course_id = ?
        `;

        const [rows] = await pool.execute(query, [courseId]);
        res.status(200).json({
            success: true,
            message: `Course progress reset successfully`,
            data: {
                affectedRows: rows.affectedRows
            }
        });

    } catch (error) {
        console.error("Error resetting course progress: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while resetting course progress",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};


export const fetchLatestQuestion = async (req, res) => {
    const { topic_id } = req.query;

    if (!topic_id) {
        return res.status(400).json({
            success: false,
            message: "topic_id is required",
        });
    }
    try {
        const query = `
            SELECT * FROM questions
            WHERE topic_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const [rows] = await pool.execute(query, [topic_id]);

        if (rows.length === 0) {
            return res.status(200).json({
                success: false,
                message: "No questions found for the given topic_id",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Latest question fetched successfully",
            data: rows[0],
        });
    } catch (error) {
        console.error("Error fetching latest question: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching latest question",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}



export const generateQuestion = async (req, res) => {

    const { topicId, topicTitle, difficultyLevel } = req.body;

    // console.log("Generate question request body: ", topicId , topicTitle , difficultyLevel);
    if (!topicId || !topicTitle || !difficultyLevel) {
        return res.status(400).json({
            success: false,
            message: "topicId, topicTitle and difficultyLevel are required",
        });

    }

    // console.log("Received generate question request: ", {topicId , topicTitle , difficultyLevel});
    // console.log("API KEY " , process.env.GEMINI_API_KEY);

    try {

        //to block users from generating more than 3 questions in a day for a particular topic
        const countQuery = `
                SELECT COUNT(*) AS generation_count
                FROM question_generations
                WHERE topic_id = ?
            `;

        const [countRows] = await pool.execute(countQuery, [topicId]);
        const generationCount = countRows[0].generation_count;
        if (generationCount >= 3) {
            return res.status(429).json({
                success: false,
                message: "Generation limit reached for this topic. Please try again later.",
            });
        }
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            contents: [
                {
                    parts: [
                        {
                            text: QuestionPrompt(topicTitle, difficultyLevel)
                        },
                    ],
                },
            ],
        }, {
            headers: {
                "Content-Type": "application/json",
            }
        }
        );

        console.log("Full Gemini Response:", JSON.stringify(geminiResponse.data, null, 2));

        // Check if the response has the expected structure
        if (!geminiResponse.data || !geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
            throw new Error("Invalid response structure from Gemini API");
        }

        let textResponse = geminiResponse.data.candidates[0].content.parts[0].text;

        // Clean the response by removing markdown code blocks
        textResponse = textResponse.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();

        console.log("Cleaned text response:", textResponse);

        const questionData = JSON.parse(textResponse);

        const insertQuery = `
                INSERT INTO questions (topic_id, topic_title, difficulty_level, title, description, samples)
                VALUES (?, ?, ? ,?, ?, ? ) ON DUPLICATE KEY 
                UPDATE 
                title  = VALUES(title),
                description = VALUES(description),
                samples = VALUES(samples),
                updated_at = CURRENT_TIMESTAMP
            `;

        await pool.execute(insertQuery, [
            topicId,
            topicTitle,
            difficultyLevel,
            questionData.title,
            questionData.description,
            JSON.stringify(questionData.samples || [])
        ]);


        const logGenerationQuery = `
                INSERT INTO question_generations (topic_id, difficulty_level)
                VALUES (?, ?)
            `;
        await pool.execute(logGenerationQuery, [topicId, difficultyLevel]);
        console.log("Logged Question Generation: ", { topicId, difficultyLevel });
        return res.status(200).json({
            success: true,
            message: "Question generated successfully",
            data: questionData,
        });
    } catch (error) {
        console.error("Error generating question: ", error.response ? error.response.data : error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to generate question",
            error: error.response ? error.response.data : error.message,
        });
    }
}


export const getTopicAIContent = async (req, res) => {
    try {
        const { topicId } = req.params;
        const { refresh } = req.query;
        const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

        // First, check if we have any mapping for this topic
        const [mappings] = await pool.execute(`
            SELECT 
                m.*,
                t.topic_title,
                t.topic_description,
                c.course_title
            FROM docs_url_mapping m
            JOIN topics t ON m.topic_id = t.topic_id
            JOIN courses c ON t.course_id = c.course_id
            WHERE m.topic_id = ? AND m.is_active = 1
            ORDER BY m.priority DESC
            LIMIT 1
        `, [topicId]);

        if (mappings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No documentation mapping found for this topic'
            });
        }

        const mapping = mappings[0];

        // Check for existing valid content first
        let [existingContent] = await pool.execute(`
            SELECT * FROM ai_content 
            WHERE topic_id = ? 
            AND mapping_id = ?
            AND status = 'completed'
            AND ai_content IS NOT NULL
            ORDER BY last_updated_at DESC 
            LIMIT 1
        `, [topicId, mapping.mapping_id]);

        // Return cached content if valid and not expired
        if (existingContent && !refresh) {
            const contentAge = Date.now() - new Date(existingContent.last_updated_at).getTime();
            if (contentAge < CACHE_DURATION) {
                return res.status(200).json({
                    success: true,
                    message: 'Content fetched from cache',
                    data: {
                        content: {
                            ...existingContent,
                            topic_title: mapping.topic_title,
                            topic_description: mapping.topic_description,
                            course_title: mapping.course_title,
                            official_docs_url: mapping.official_docs_url,
                            cached: true
                        }
                    }
                });
            }
        }

        // Check if content is already being generated
        // Replace the existing processing check query with:
        const [processingContent] = await pool.execute(`
            SELECT last_updated_at FROM ai_content 
            WHERE topic_id = ? 
            AND mapping_id = ? 
            AND status = 'processing'
            ORDER BY last_updated_at DESC
            LIMIT 1
        `, [topicId, mapping.mapping_id]);

        // Then update the processing age check:
        if (processingContent) {
            const processingAge = Date.now() - new Date(processingContent.last_updated_at).getTime();
            if (processingAge < 300000) { // 5 minutes
                return res.status(202).json({
                    success: true,
                    message: 'Content generation in progress',
                    data: {
                        status: 'processing',
                        startedAt: processingContent.last_updated_at
                    }
                });
            }
        }

        // Generate new content
        try {
            // Start content generation
            const result = await aiContentService.processContentUpdate(topicId, mapping.mapping_id);

            if (!result?.content?.ai_content) {
                throw new Error('Content generation failed to produce valid content');
            }


            return res.status(200).json({
                success: true,
                message: 'Content generated successfully',
                data: {
                    content: {
                        ...result,
                        topic_title: mapping.topic_title,
                        topic_description: mapping.topic_description,
                        course_title: mapping.course_title,
                        official_docs_url: mapping.official_docs_url
                    }
                }
            });
        } catch (genError) {
            console.error('Content generation error:', genError);

            // Update status to error
            await pool.execute(`
                UPDATE ai_content 
                SET status = 'error',
                    error_message = ?
                WHERE topic_id = ? AND mapping_id = ?
            `, [genError.message, topicId, mapping.mapping_id]);

            throw genError;
        }

    } catch (error) {
        console.error('Error in getTopicAIContent:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate/fetch content',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const updateTopicContent = async (req, res) => {
    try {
        const { topicId } = req.params;
        const { force } = req.query;

        // Get topic and mapping details
        const [mappings] = await pool.execute(`
            SELECT 
                m.*,
                t.topic_title,
                c.course_title
            FROM docs_url_mapping m
            JOIN topics t ON m.topic_id = t.topic_id
            JOIN courses c ON t.course_id = c.course_id
            WHERE m.topic_id = ? AND m.is_active = 1
            ORDER BY m.priority DESC
        `, [topicId]);

        if (mappings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active documentation mapping found for this topic'
            });
        }

        const mapping = mappings[0];

        // Check last update time unless force=true
        if (!force) {
            const [lastUpdate] = await pool.execute(`
                SELECT last_scraped_at 
                FROM ai_content 
                WHERE topic_id = ? AND mapping_id = ?
                ORDER BY last_scraped_at DESC 
                LIMIT 1
            `, [topicId, mapping.mapping_id]);

            if (lastUpdate.length > 0) {
                const hoursSinceLastUpdate = (Date.now() - new Date(lastUpdate[0].last_scraped_at)) / (1000 * 60 * 60);
                if (hoursSinceLastUpdate < 24) {
                    return res.status(200).json({
                        success: true,
                        message: 'Content was recently updated',
                        data: {
                            changed: false,
                            reason: 'recently_updated',
                            lastUpdate: lastUpdate[0].last_scraped_at
                        }
                    });
                }
            }
        }

        // Process content update
        const result = await aiContentService.processContentUpdate(topicId, mapping.mapping_id);

        res.status(200).json({
            success: true,
            message: result.changed ? 'Content updated successfully' : 'No update needed',
            data: result
        });

    } catch (error) {
        console.error('Error updating topic content:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update topic content',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};