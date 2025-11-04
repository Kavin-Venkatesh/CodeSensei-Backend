import pool from '../config/db.js';

export const getAllCourses = async (req, res) => {
    try {
        const userId = req.user.id; 
        
        if( !userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const query = `
            SELECT
                c.course_id,
                c.course_title,
                c.description,
                c.language_id,
                c.created_at,
                COUNT(DISTINCT t.topic_id) AS total_topics,
                COALESCE(SUM(CASE WHEN cp.is_completed = 1 THEN 1 ELSE 0 END), 0) AS completed_topics
            FROM courses c
            LEFT JOIN topics t ON c.course_id = t.course_id
            LEFT JOIN course_progress cp ON t.topic_id = cp.topic_id AND cp.user_id = ?
            GROUP BY c.course_id, c.course_title, c.description, c.language_id, c.created_at
            ORDER BY c.created_at DESC
        `;

        const [rows] = await pool.execute(query, [userId]);
        const coursesWithProgress = rows.map(course => {
            const totalTopics = Number(course.total_topics) || 0;
            const completedTopics = Number(course.completed_topics) || 0;
            const progress = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
            return {
                course_id: course.course_id,
                course_title: course.course_title,
                description: course.description,
                language_id: course.language_id,
                created_at: course.created_at,
                progress: Math.round(progress * 100) / 100 
            }
            
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