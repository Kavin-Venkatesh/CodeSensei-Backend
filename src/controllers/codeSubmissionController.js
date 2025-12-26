import axios from 'axios';
import pool from '../config/db.js';

const JUDGE0_API = "https://judge0-ce.p.rapidapi.com";
const RAPIDAPI_HOST = process.env.XRapidApiHost;
const RAPIDAPI_KEY = process.env.XRapidAPIKey;

const getSubmissionsToken = async (code, language_id, stdin) => {

  try {
    const submission = await axios.post(`${JUDGE0_API}/submissions/?base64_encoded=false&wait=false`, {
      source_code: code,
      language_id,
      stdin: stdin || "",
    },
      {
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Host": RAPIDAPI_HOST,
          "X-RapidAPI-Key": RAPIDAPI_KEY,
        },

      })


    return submission.data.token;
  }
  catch (err) {
    throw err;
  }
}


const getSubmissionResult = async (
  submissionToken,
  maxAttempts = 10,
  intervalMs = 1500
) => {
  let result;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await axios.get(
      `${JUDGE0_API}/submissions/${submissionToken}?base64_encoded=false&fields=stdout,stderr,status,compile_output,time,memory`,
      {
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Host": RAPIDAPI_HOST,
          "X-RapidAPI-Key": RAPIDAPI_KEY,
        },

      }
    );

    result = response.data;

    // Status: 1 = In Queue, 2 = Processing, >=3 = Done
    if (result.status && result.status.id >= 3) {
      return result;
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return result;
};

export const runCode = async (req, res) => {
  try {
    const { code, language_id, topic_id, stdin, userToken } = req.body;

    if (!code || !language_id || !userToken) {
      return res.status(400).json({
        success: false,
        message: "Code or language ID or User Token is Not found"
      });
    }

    const submissionToken = await getSubmissionsToken(code, language_id, stdin);

    const result = await getSubmissionResult(submissionToken);


    return res.status(200).json({
      success: true,
      topic_id,
      language_id,
      output: result.stdout,
      error: result.stderr || result.compile_output,
      status: result.status,
      executionTime: result.time,
      memoryUsage: result.memory
    });

  } catch (err) {
    console.error("API error:", err.message);
    return res.status(500).json({
      success: "error",
      message: "Failed to run code"
    });
  }
}


const submitBatch = async (code, language_id, testCases) => {
  const submissions = testCases.map((testCase) => ({
    language_id,
    source_code: code,
    stdin: testCase.input || "",
  }));

  const response = await axios.post(
    `${JUDGE0_API}/submissions/batch?base64_encoded=false&wait=false`,
    { submissions },
    {
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "X-RapidAPI-Key": RAPIDAPI_KEY,
      },
    }
  );

  if (!response.data || !Array.isArray(response.data)) {
    console.error("❌ Unexpected response from Judge0 batch submission API:", response.data);
    return [];
  }

  const tokens = response.data.map((item) => item?.token).filter(Boolean);

  if (tokens.length === 0) {
    console.error("❌ No tokens returned from Judge0 batch submission API");
  }

  return tokens;
};


const fetchBatchResults = async (tokens, maxAttempts = 10, intervalMs = 1500) => {
  let attempt = 0;
  let results = [];

  while (attempt < maxAttempts) {
    const tokenList = tokens.join(",");
    const response = await axios.get(
      `${JUDGE0_API}/submissions/batch?tokens=${tokenList}&base64_encoded=false`,
      {
        headers: {
          "X-RapidAPI-Host": RAPIDAPI_HOST,
          "X-RapidAPI-Key": RAPIDAPI_KEY,
        },
      }
    );

    results = response.data?.submissions || [];


    const validResults = results.filter((r) => r && r.status);

    const allDone =
      validResults.length === tokens.length &&
      validResults.every((r) => r.status.id >= 3);

    if (allDone) break;

    attempt++;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return results;
};

export const runCodeAgainstTestCases = async (req, res) => {
  try {
    const { code, language_id, testCases, question_id } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid code.",
      });
    }

    if (!language_id || typeof language_id !== "number") {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid language_id.",
      });
    }

    if (!Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No test cases provided.",
      });
    }


    const tokens = await submitBatch(code, language_id, testCases);

    if (!tokens.length) {
      return res.status(500).json({
        success: false,
        message: "Failed to submit code to Judge0.",
      });
    }


    const resultsData = await fetchBatchResults(tokens);

    const results = testCases.map((tc, i) => {
      const result = resultsData[i] || {};
      const actualOutput = result.stdout ? result.stdout.trim() : "";
      const expectedOutput = tc.output ? tc.output.trim() : "";

      return {
        input: tc.input || "",
        expectedOutput,
        actualOutput,
        passed: actualOutput === expectedOutput,
        error: result.stderr || result.compile_output || null,
        status: result.status || { id: 0, description: "Unknown" },
        executionTime: result.time || null,
        memoryUsage: result.memory || null,
      };
    });


    res.status(200).json({
      success: true,
      question_id,
      language_id,
      results,
    });
  } catch (err) {
    console.error("❌ runCodeAgainstTestCases Error:", err.message);

    res.status(500).json({
      success: false,
      message: "Internal server error while running code.",
      error: err.message,
    });
  }
};


export const saveSubmission = async(req, res) =>{
  try{
    const {
      user_id,
      question_id,
      code,
      language_id,
      language
    } = req.body;

    if( !user_id ){
      return res.status(400).json({
        success : false,
        message : "User ID is not found!"
      })
    }

    if( !question_id ){
      return res.status(400).json({
        success : false,
        message : "Question Id is not found!"
      })
    }

    if( !code ){
      return res.status(400).json({
        success : false,
        message : "Please write some code!"
      })
    }

    if (!language || !language_id){
      return res.status(400).json({
        success : false,
        message : "Language details not found"
      })
    }


    const query = `
        INSERT INTO submissions(user_id , question_id , code , language_id , language) 
        VALUES (?,?,?,?,?)
          ON DUPLICATE KEY UPDATE 
            code = VALUES(code),
            language_id = VALUES(language_id),
            language = VALUES(language)
    `;
    
    const values = [
      user_id,
      question_id,
      code,
      language_id,
      language
    ];


    const [result] = await pool.execute(query , values);

    if( !result){
      return res.status(500).json({
        success : false,
        message : "Error While creating code submission"
      })
    }

    res.status(200).json({
      success : true,
      message : result.affectedRows === 1 
      ? "Code submitted Successfully" 
      : "Code updated Successfully"
    })
  }
  catch(err){
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getUserSubmissions = async (req, res) => {
  try {
    const user_id  = req.params.id; 

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required!"
      });
    }

    const query = `
      SELECT question_id, code, language_id, language
      FROM submissions
      WHERE user_id = ?
      ORDER BY question_id DESC
    `;

    const [rows] = await pool.execute(query, [user_id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No submissions found for this user."
      });
    }

    res.status(200).json({
      success: true,
      submissions: rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
