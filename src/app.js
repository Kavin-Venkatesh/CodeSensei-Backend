import express from 'express';
import bodyParser from 'body-parser';
import expressStatusMonitor from 'express-status-monitor';
import cors from 'cors';
import cookieParser from "cookie-parser";

// Import database to initialize connection
import './config/db.js';

import authRouter from './routes/auth.js';
import coursesRouter from './routes/courses.js';
import topicsRouter from './routes/topics.js';
import submissionRouter from './routes/submissions.js';
import contentScheduler from './services/contentScheduler.js';

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
app.use('/api/courses', coursesRouter);
app.use('/api/topics' , topicsRouter);
app.use('/api/code' , submissionRouter);


app.get('/api/health', (req, res) => {
    res.status(200).send('<======API is running======>');
});

export default app;
