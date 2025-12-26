import { addCourse , addTopics} from "../controllers/adminController.js";
import { adminOnly } from "../middleware/auth.js";

import express from "express";
const router = express.Router();


router.post('/add-course', adminOnly , addCourse);
router.post('/add-topics', adminOnly , addTopics);

export default router;

