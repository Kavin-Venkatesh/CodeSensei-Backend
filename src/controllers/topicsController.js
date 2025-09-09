import pool from "../config/db.js";

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