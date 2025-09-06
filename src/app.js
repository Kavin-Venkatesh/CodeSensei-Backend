import express from 'express';
import bodyParser from 'body-parser';
import expressStatusMonitor from 'express-status-monitor';
import cors from 'cors';
import cookieParser from "cookie-parser";

// Import database to initialize connection
import './config/db.js';
import db from './config/db.js';

import authRouter from './routes/auth.js';


const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(expressStatusMonitor());
app.use(express.urlencoded({ extended: true }));


const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],  // Adjust this to your client's origin
    credentials: true,               // Allow cookies to be sent
};

app.use(cors(corsOptions));

app.use('/api/auth' , authRouter);

app.get('/api/health', (req, res) => {
    res.status(200).send('<======API is running======>');
});

// Database health check endpoint
// app.get('/api/db-health', async (req, res) => {
//     try {
//         const [rows] = await db.query('SELECT 1 as connected, NOW() as server_time, DATABASE() as database_name, VERSION() as mysql_version');
//         res.status(200).json({
//             status: 'success',
//             message: 'Database connection is healthy',
//             data: {
//                 connected: true,
//                 server_time: rows[0].server_time,
//                 database: rows[0].database_name,
//                 mysql_version: rows[0].mysql_version
//             }
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: 'error',
//             message: 'Database connection failed',
//             error: error.message
//         });
//     }
// });

export default app;
