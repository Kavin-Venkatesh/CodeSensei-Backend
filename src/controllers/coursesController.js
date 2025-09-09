import pool from '../config/db.js';

// Get all available courses
export const getAllCourses = async (req, res) => {
    try {
        const query = `
            SELECT 
                course_id,
                course_title,
                description,
                language_id,
                created_at
            FROM courses
            ORDER BY created_at DESC
        `;

        const [rows] = await pool.execute(query);

        res.status(200).json({
            success: true,
            message: 'Courses fetched successfully',
            data: {
                courses: rows,
                total: rows.length
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
