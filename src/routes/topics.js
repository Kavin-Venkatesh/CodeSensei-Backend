import express from 'express';
import { getTopicsByID,
        getTopicAIContent,
        updateTopicContent,
        markAsCompleted,
        resetCourseProgress
    } from '../controllers/topicsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/ai-content/:topicId', getTopicAIContent);
router.put('/mark-completed/:topicId', markAsCompleted);
router.put('/reset-topics/:courseId', resetCourseProgress);
router.post('/topic/:topicId/update', updateTopicContent);
router.get('/course/:courseId', getTopicsByID);


export default router;