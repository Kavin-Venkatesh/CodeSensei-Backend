import express from 'express';
import { getTopicsByID,
        generateQuestion,
        fetchLatestQuestion
    } from '../controllers/topicsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/latest-question', fetchLatestQuestion);
router.post('/generate-question', generateQuestion);
router.get('/:courseId', getTopicsByID);


export default router;