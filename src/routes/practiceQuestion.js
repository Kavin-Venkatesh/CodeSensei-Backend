import express from 'express';

import { storeQuestions , getQuestionsByUserID } from '../controllers/questionsController.js';
import { authenticateToken } from '../middleware/auth.js';


const router = express.Router();
router.use(authenticateToken);

router.post('/store-questions' , storeQuestions);
router.get('/fetch-questions/:id' , getQuestionsByUserID);
export default router