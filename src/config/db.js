import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "codesensei",
    port: process.env.DB_PORT,  
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl :{
        ca: process.env.DB_CA,  // path to downloaded CA cert
        rejectUnauthorized: true   
    }
};

const pool = mysql.createPool(dbConfig);
const promisePool = pool.promise();

// Test database connection with detailed info
promisePool.getConnection()
    .then(connection => {   
        console.log('✅ Connected to MySQL database successfully!');
        // console.log(`📊 Database: ${dbConfig.database}`);
        // console.log(`🏠 Host: ${dbConfig.host}`);
        // console.log(`👤 User: ${dbConfig.user}`);
        // console.log(`🔗 Connection ID: ${connection.threadId}`);
        connection.release();
    })
    .catch(err => {
        console.error('❌ Unable to connect to the MySQL database:');
        console.error(`Host: ${dbConfig.host}`);
        console.error(`Database: ${dbConfig.database}`);
        console.error(`User: ${dbConfig.user}`);
        console.error('Error details:', err.message);
        // Don't exit process, let the app continue but log the error
    });


export default promisePool;
