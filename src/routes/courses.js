import express from 'express';
import { 
    getAllCourses, 
} from '../controllers/coursesController.js';
import { authenticateToken } from '../middleware/auth.js';
    
const router = express.Router();


router.use(authenticateToken);

// GET /api/courses - Get all courses
router.get('/:userId', getAllCourses);



export default router;
