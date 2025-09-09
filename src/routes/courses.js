import express from 'express';
import { 
    getAllCourses, 
    getCourseById
} from '../controllers/coursesController.js';
import { authenticateToken } from '../middleware/auth.js';
    
const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/courses - Get all courses
router.get('/', getAllCourses);

// GET /api/courses/:courseId - Get course by ID
router.get('/:courseId', getCourseById);


export default router;
