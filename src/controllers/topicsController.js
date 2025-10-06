import axios from "axios";
import pool from "../config/db.js";

import { QuestionPrompt } from "../utils/prompts.js";
import scraperService from "../services/scrapperServices.js";
import aiContentService from "../services/aiContentServices.js";

import { openRouterClient, aiConfig } from "../config/aiConfig.js";
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

  if (!topicId || !topicTitle || !difficultyLevel) {
    return res.status(400).json({
      success: false,
      message: "topicId, topicTitle and difficultyLevel are required",
    });
  }

  try {
    // 🔹 Check question generation limit
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

    // 🔹 Call OpenRouter API
    const fetchResponse = await fetch(aiConfig.openrouter.baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${aiConfig.openrouter.apiKey}`,
        "HTTP-Referer": "http://localhost:3000", // update to production URL if needed
        "X-Title": "CodeSensei",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiConfig.openrouter.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: QuestionPrompt(topicTitle, difficultyLevel),
              },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const openRouterResponse = await fetchResponse.json();

    console.log("Full OpenRouter Response:", JSON.stringify(openRouterResponse, null, 2));

    if (!openRouterResponse?.choices?.length) {
      throw new Error("Invalid response structure from OpenRouter API");
    }

    // ✅ Correct content extraction for Claude/Anthropic models
    let textResponse = openRouterResponse.choices[0].message.content || "";

    // ✅ Clean markdown/code block formatting
    textResponse = textResponse
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim();

    console.log("Cleaned text response:", textResponse);

    // ✅ Validate before parsing
    if (!textResponse || !textResponse.trim().startsWith("{")) {
      throw new Error("Invalid JSON content returned by model:\n" + textResponse);
    }

    // ✅ Parse JSON safely
    let questionData;
    try {
      questionData = JSON.parse(textResponse);
    } catch (err) {
      console.error("❌ JSON parse error. Model returned invalid JSON:", textResponse);
      throw new Error("Failed to parse JSON from model output.");
    }

    // 🔹 Insert or update question record
    const insertQuery = `
      INSERT INTO questions (topic_id, topic_title, difficulty_level, title, description, samples)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
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
      JSON.stringify(questionData.samples || []),
    ]);

    // 🔹 Log the generation
    const logGenerationQuery = `
      INSERT INTO question_generations (topic_id, difficulty_level)
      VALUES (?, ?)
    `;
    await pool.execute(logGenerationQuery, [topicId, difficultyLevel]);

    // 🔹 Success response
    return res.status(200).json({
      success: true,
      message: "Question generated successfully",
      data: questionData,
    });
  } catch (error) {
    console.error("Error generating question:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate question",
      error: error.message || error,
    });
  }
};
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