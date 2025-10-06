import express from 'express';
import {
    runCode,
    runCodeAgainstTestCases
} from "../controllers/codeSubmissionController.js";

import { authenticateToken } from '../middleware/auth.js';

const router =  express.Router();

router.use(authenticateToken);


router.post('/executetestcases', runCodeAgainstTestCases);
router.post('/execute', runCode);



export default router;