import express from 'express';

import { 
        storeQuestions ,
        getQuestionsByUserID,
        deleteQuestionByID ,
        deleteAllQuestionsForUser
    } from '../controllers/questionsController.js';
import { authenticateToken } from '../middleware/auth.js';


const router = express.Router();
router.use(authenticateToken);

router.post('/store-questions' , storeQuestions);
router.get('/fetch-questions/:id' , getQuestionsByUserID);
router.delete('/delete-question/:id' , deleteQuestionByID);
router.delete('/delete-all-questions/:id' , deleteAllQuestionsForUser);
export default router;