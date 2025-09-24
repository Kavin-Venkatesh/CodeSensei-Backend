import pool from '../config/db.js';

// Get all available courses
export const getAllCourses = async (req, res) => {
    try {
        const query = `
            SELECT 
                c.course_id,
                c.course_title,
                c.description,
                c.language_id,
                c.created_at,
                COUNT(t.topic_id) AS total_topics,
            SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) AS completed_topics
            FROM courses c
            LEFT JOIN topics t ON c.course_id = t.course_id
            GROUP BY c.course_id, c.course_title, c.description, c.language_id, c.created_at
            ORDER BY c.created_at DESC

        `;

        const [rows] = await pool.execute(query);

        const coursesWithProgress = rows.map(course => {
            const progress = course.total_topics > 0 ? (course.completed_topics / course.total_topics) * 100 : 0;
            return {
                ...course,
                progress: Math.round(progress * 100) / 100 // Round to 2 decimal places
            };
        });

        res.status(200).json({
            success: true,
            message: 'Courses fetched successfully',
            data: {
                courses: coursesWithProgress,
                total: coursesWithProgress.length
            }
        });


    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching courses',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get course by ID
export const getCourseById = async (req, res) => {
    try {
        const { courseId } = req.params;

        const query = `
            SELECT 
                course_id,
                course_title,
                description,
                language_id,
                created_at
            FROM courses
            WHERE course_id = ?
        `;

        const [rows] = await pool.execute(query, [courseId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Course fetched successfully',
            data: {
                course: rows[0]
            }
        });

    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching course',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
