import express from 'express';

import {
    runCode
} from "../controllers/codeSubmissionController.js";

import { authenticateToken } from '../middleware/auth.js';

const router =  express.Router();

router.use(authenticateToken);
router.post('/execute' , runCode);

export default router;