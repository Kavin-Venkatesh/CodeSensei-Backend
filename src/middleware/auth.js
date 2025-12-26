import { verifyToken } from '../utils/jwt.js';

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token is required'
        });
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};


export const adminOnly = (req, res, next) => {

    const apiKey = req.headers['x-admin-key'];
    const emailID = req.headers['x-admin-email'];

    if (apiKey !== process.env.ADMIN_API_KEY ) {
        return res.status(403).json({
            success: false,
            message: 'Invalid admin API key'
        });
    }


    if( emailID !== process.env.ADMIN_EMAIL_ID ){
        return res.status(403).json({
            success: false,
            message: 'Unauthorized email ID'
        });
    }

    next();
};

