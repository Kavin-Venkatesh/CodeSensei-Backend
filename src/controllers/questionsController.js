import db  from "../config/db.js"; 
import pool from "../config/db.js"
import Joi from "joi";

export const storeQuestions = async (req, res) => {
    try {
        const requestSchema = Joi.object({
            questions: Joi.array().items(
                Joi.object({
                    title: Joi.string().required(),
                    description: Joi.string().required(),
                    sampleInput: Joi.string().allow(""),
                    sampleOutput: Joi.string().allow(""),
                    explanation: Joi.string().allow(""),
                    testCases: Joi.array().items(
                        Joi.object({
                            input: Joi.string().required(),
                            output: Joi.string().required()
                        })
                    ).min(1).required()
                })
            ).min(1).required()
        });

        const { error, value } = requestSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { questions } = value;

        const createdQuestions = [];
        const createdBy = req.user?.id || 1;

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            for (const question of questions) {
                const [result] = await connection.query(
                    `INSERT INTO practice_questions 
                    (question_title, question_description, sample_input, sample_output, explanation, created_by) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        question.title,
                        question.description,
                        question.sampleInput,
                        question.sampleOutput,
                        question.explanation,
                        createdBy
                    ]
                );

                const questionId = result.insertId;

                const testCasePromises = question.testCases.map(tc =>
                    connection.query(
                        `INSERT INTO test_cases (question_id, input, expected_output) VALUES (?, ?, ?)`,
                        [questionId, tc.input, tc.output]
                    )
                );

                await Promise.all(testCasePromises);

                createdQuestions.push({
                    questionId,
                    title: question.title
                });
            }

            await connection.commit();

            return res.status(201).json({
                success: true,
                message: "Questions and test cases saved successfully",
                createdQuestions
            });

        } catch (err) {
            await connection.rollback();
            console.error("Database error:", err);
            return res.status(500).json({
                success: false,
                message: "Database error while storing questions"
            });
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error("API error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to store questions"
        });
    }
};


export const getQuestionsByUserID  = async(req , res) => {
    try{
        const userID = req.params.id;

        if( !userID){
            return res.status(404).json({
                success : false,
                message : "Invalid user id or userID not found"
            })
        }


        const query = `
            SELECT 
                pq.question_id,
                pq.question_title,
                pq.question_description,
                pq.sample_input,
                pq.sample_output,
                pq.explanation,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'test_case_id' , tc.test_id,
                        'input' , tc.input,
                        'output' , tc.expected_output
                    )
                ) AS test_cases
            FROM
                practice_questions pq
            JOIN
                test_cases tc
            ON 
                tc.question_id =  pq.question_id
            WHERE 
                pq.created_by =  ?
            GROUP BY
                pq.question_id
            ORDER BY
                pq.question_id
        `

        const [rows] = await pool.execute(query , [userID]);

        if( rows.length === 0){
            return res.status(404).json({
                success : false,
                message : "No Question Found"
            })
        }

        res.status(200).json({
            success : true,
            message : "Questions fetched successfully",
            data :  {
                questions : rows
            }
        });
    }catch( err){
        console.log("error while fetching questions" , err);
        res.status(500).json({
            success : false,
            message : 'Internal server error while fetching questions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}


export const deleteQuestionByID =  async(req , res) =>{
    try{
        const questionID = req.params.id;
       
        if( !questionID){
            return res.status(404).json({
                success : false,
                message : "Invalid question id or questionID not found"
            })
        }
        const deleteQuery = `
            DELETE FROM practice_questions
            WHERE question_id = ?
        `;

        const [result] = await pool.execute(deleteQuery , [questionID]);

        if( result.affectedRows === 0){
            return res.status(404).json({
                success : false,
                message : "Question not found or already deleted"
            })
        }

        res.status(200).json({
            success : true,
            message : "Question deleted successfully"
        })
    }catch( err){
        console.log("error while deleting question" , err);
        res.status(500).json({
            success : false,
            message : 'Internal server error while deleting question',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}


export const deleteAllQuestionsForUser = async(req , res) => {

    console.log("deleteAllQuestionsForUser called");
    try{
        const userID = req.params.id;

        console.log("userID" , userID);
        if( !userID){
            return res.status(404).json({
                success : false,
                message : "Invalid user id or userID not found"
            })
        }

        const deleteQuery = `
            DELETE FROM practice_questions
            WHERE created_by = ?
        `;

        const [result] = await pool.execute(deleteQuery , [userID]);

        if( result.affectedRows === 0){
            return res.status(404).json({
                success : false,
                message : "No Questions found for the user or already deleted"
            })
        }

        res.status(200).json({
            success : true,
            message : "All Questions deleted successfully for the user"
        })
    }
    catch( err){
        console.log("error while deleting all questions for user" , err);
        res.status(500).json({
            success : false,
            message : 'Internal server error while deleting all questions for user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
