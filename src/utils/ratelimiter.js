import rateLimit from 'express-rate-limit';

export const codeExecutionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        success: false,
        message: 'Too many code execution requests, please try again after a minute'
    }
});

