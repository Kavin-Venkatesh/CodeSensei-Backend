import express from 'express';
import { getTopicsByID } from '../controllers/topicsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/:courseId', getTopicsByID);

export default router;