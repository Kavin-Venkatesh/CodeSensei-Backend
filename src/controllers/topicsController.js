import axios from "axios";
import pool from "../config/db.js";

import QuestionPrompt from "../utils/questionPrompt.js";
// import { text } from "body-parser";

export const getTopicsByID = async (req, res) => {
    try {
        const { courseId } = req.params;

        // Validate courseId
        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required",
            });
        }

        const query = `
            SELECT
                t.topic_id,
                t.topic_title,
                t.topic_description,
                c.language_id
            FROM topics t
            INNER JOIN 
                courses c
            ON
                t.course_id = c.course_id
            WHERE
                c.course_id = ?
            ORDER BY
                t.order_index ASC
        `;

        const [rows] = await pool.execute(query, [courseId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Topics not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Topics Fetched successfully",
            data: {
                topics: rows,
                total: rows.length,
            },
        });
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching courses',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
};


export const fetchLatestQuestion = async(req , res) =>{
    const { topic_id } = req.query;

    if(!topic_id){
        return res.status(400).json({
            success: false,
            message: "topic_id is required",
        });
    }
    try{
        const query = `
            SELECT * FROM questions
            WHERE topic_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const [rows] = await pool.execute(query , [topic_id]);

        if(rows.length === 0){
            return res.status(200).json({
                success: false,
                message: "No questions found for the given topic_id",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Latest question fetched successfully",
            data: rows[0],
        });
    }catch(error){
        console.error("Error fetching latest question: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching latest question",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}



export const generateQuestion = async( req, res) => {
    
        const {topicId  , topicTitle , difficultyLevel} = req.body;

        // console.log("Generate question request body: ", topicId , topicTitle , difficultyLevel);
        if( !topicId || !topicTitle || !difficultyLevel ){
            return res.status(400).json({
                success: false,
                message: "topicId, topicTitle and difficultyLevel are required",
            });

        }

        // console.log("Received generate question request: ", {topicId , topicTitle , difficultyLevel});
        // console.log("API KEY " , process.env.GEMINI_API_KEY);

        try{

            //to block users from generating more than 3 questions in a day for a particular topic
            const countQuery = `
                SELECT COUNT(*) AS generation_count
                FROM question_generations
                WHERE topic_id = ?
            `;

            const [countRows] = await pool.execute(countQuery, [topicId]);
            const generationCount = countRows[0].generation_count;
            if(generationCount >= 3){
                return res.status(429).json({
                    success: false,
                    message: "Generation limit reached for this topic. Please try again later.",
                });
            }
            const geminiResponse = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,{
                    contents :[
                        {
                            parts:[
                                {
                                    text : QuestionPrompt(topicTitle , difficultyLevel)
                                },
                            ],
                        },
                    ],
                },{
                    headers : {
                        "Content-Type" : "application/json",
                    }
                }
            );

            console.log("Full Gemini Response:", JSON.stringify(geminiResponse.data, null, 2));

            // Check if the response has the expected structure
            if (!geminiResponse.data || !geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
                throw new Error("Invalid response structure from Gemini API");
            }

            let textResponse = geminiResponse.data.candidates[0].content.parts[0].text;
            
            // Clean the response by removing markdown code blocks
            textResponse = textResponse.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
            
            console.log("Cleaned text response:", textResponse);

            const questionData = JSON.parse(textResponse);

            const insertQuery = `
                INSERT INTO questions (topic_id, topic_title, difficulty_level, title, description, samples)
                VALUES (?, ?, ? ,?, ?, ? ) ON DUPLICATE KEY 
                UPDATE 
                title  = VALUES(title),
                description = VALUES(description),
                samples = VALUES(samples),
                updated_at = CURRENT_TIMESTAMP
            `;

            await pool.execute(insertQuery, [
                    topicId,
                    topicTitle,
                    difficultyLevel,
                    questionData.title,
                    questionData.description,
                    JSON.stringify(questionData.samples || [])
                ]);

                
            const logGenerationQuery = `
                INSERT INTO question_generations (topic_id, difficulty_level)
                VALUES (?, ?)
            `;
            await pool.execute(logGenerationQuery, [topicId, difficultyLevel]);
            console.log("Logged Question Generation: ", { topicId, difficultyLevel });
            return res.status(200).json({
                success: true,
                message: "Question generated successfully",
                data: questionData,
            });
        }catch(error){
            console.error("Error generating question: ", error.response ? error.response.data : error.message);
            return res.status(500).json({
                success: false,
                message: "Failed to generate question",
                error: error.response ? error.response.data : error.message,
            });
        }
        // Simulate question generation
}


