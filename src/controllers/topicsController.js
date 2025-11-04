import axios from "axios";
import pool from "../config/db.js";

import aiContentService from "../services/aiContentServices.js";

export const getTopicsByID = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user?.id || req.query.user_id;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required",
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required to fetch progress",
            });
        }

        const query = `
      SELECT 
        t.topic_id,
        t.topic_title,
        t.topic_description,
        t.order_index,
        c.language_id,
        COALESCE(cp.is_completed, 0) AS is_completed,
        cp.completed_at
      FROM topics t
      INNER JOIN courses c ON t.course_id = c.course_id
      LEFT JOIN course_progress cp 
        ON cp.topic_id = t.topic_id 
       AND cp.user_id = ?
      WHERE c.course_id = ?
      ORDER BY t.order_index ASC
    `;

        const [rows] = await pool.execute(query, [userId, courseId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Topics not found for the given course",
            });
        }

        res.status(200).json({
            success: true,
            message: "Topics fetched successfully",
            data: {
                topics: rows,
                total: rows.length,
            },
        });
    } catch (err) {
        console.error("Error fetching topics:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error while fetching topics",
            error:
                process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};

export const markAsCompleted = async (req, res) => {
    const { topicId } = req.params;
    const { is_completed } = req.body;
    const userId = req.user?.id || req.body.user_id;

    try {
        if (!topicId) {
            return res.status(400).json({
                success: false,
                message: "topicId is required",
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required",
            });
        }

        const query = `
      INSERT INTO course_progress (user_id, topic_id, is_completed, completed_at)
      VALUES (?, ?, ?, IF(? = 1, NOW(), NULL))
      ON DUPLICATE KEY UPDATE 
        is_completed = VALUES(is_completed),
        completed_at = IF(VALUES(is_completed) = 1, NOW(), NULL)
    `;

        await pool.execute(query, [userId, topicId, is_completed ? 1 : 0, is_completed ? 1 : 0]);

        res.status(200).json({
            success: true,
            message: `Topic ${is_completed ? "marked as completed" : "reset to incomplete"} successfully`,
        });
    } catch (error) {
        console.error("Error marking topic as completed:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while marking topic as completed",
            error:
                process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};
export const resetCourseProgress = async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user?.id || req.body.user_id;
    console.log("Resetting progress for courseId:", courseId, "userId:", userId);
    try {
        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "courseId is required",
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "userId is required",
            });
        }

        const query = `
            DELETE cp
            FROM course_progress cp
            INNER JOIN topics t ON cp.topic_id = t.topic_id
            WHERE t.course_id = ? AND cp.user_id = ?
        `;

        const [result] = await pool.execute(query, [courseId, userId]);

        res.status(200).json({
            success: true,
            message: "Course progress reset successfully",
            data: { affectedRows: result.affectedRows },
        });
    } catch (error) {
        console.error("Error resetting course progress:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while resetting course progress",
            error:
                process.env.NODE_ENV === "development" ? error.message : undefined,
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