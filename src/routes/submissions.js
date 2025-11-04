import express from 'express';
import {
    runCode,
    runCodeAgainstTestCases,
    saveSubmission,
    getUserSubmissions
} from "../controllers/codeSubmissionController.js";

import { authenticateToken } from '../middleware/auth.js';

const router =  express.Router();

router.use(authenticateToken);


router.post('/executetestcases', runCodeAgainstTestCases);
router.post('/execute', runCode);
router.post('/saveSubmission' , saveSubmission);
router.get('/get-submissions/:id' , getUserSubmissions);



export default router;