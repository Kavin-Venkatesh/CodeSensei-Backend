import express from "express";
import { googleLogin, refreshToken } from "../controllers/authController.js";
import cookieParser from "cookie-parser";

const router = express.Router();

router.use(cookieParser());

router.post('/google', googleLogin);
router.post('/refresh-token', refreshToken);

export default router;
