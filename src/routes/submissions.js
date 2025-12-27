import express from 'express';
import {
    runCode,
    runCodeAgainstTestCases,
    saveSubmission,
    getUserSubmissions
} from "../controllers/codeSubmissionController.js";
import { codeExecutionLimiter } from '../utils/ratelimiter.js';

import { authenticateToken } from '../middleware/auth.js';

const router =  express.Router();

router.use(authenticateToken);

router.post('/executetestcases' , codeExecutionLimiter, runCodeAgainstTestCases);
router.post('/execute', codeExecutionLimiter, runCode);
router.post('/saveSubmission' , saveSubmission);
router.get('/get-submissions/:id' , getUserSubmissions);



export default router;