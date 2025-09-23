import express from 'express';
import { getTopicsByID,
        generateQuestion,
        fetchLatestQuestion,
        getTopicAIContent,
        updateTopicContent,
        markAsCompleted,
        resetCourseProgress
    } from '../controllers/topicsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/latest-question', fetchLatestQuestion);
router.post('/generate-question', generateQuestion);
router.get('/ai-content/:topicId', getTopicAIContent);
router.put('/mark-completed/:topicId', markAsCompleted);
router.put('/reset-topics/:courseId', resetCourseProgress);
router.post('/topic/:topicId/update', updateTopicContent);
router.get('/:courseId', getTopicsByID);


export default router;