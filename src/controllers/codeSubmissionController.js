import axios from 'axios';


const JUDGE0_API = "https://judge0-ce.p.rapidapi.com";
const RAPIDAPI_HOST = process.env.XRapidApiHost;
const RAPIDAPI_KEY = process.env.XRapidAPIKey;

const getSubmissionsToken = async(code , language_id , stdin ) =>{
    try{
        const submission =  await axios.post(`${JUDGE0_API}/submissions/?base64_encoded=false&wait=false`,{
            source_code : code,
            language_id,
            stdin : stdin || "",
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
    catch(err){
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

export const runCode = async(req , res ) =>{
    try{
        const {code , language_id  , topic_id , stdin , userToken } = req.body;
        console.log(code);
        console.log(stdin)

        
        if(!code || !language_id || !userToken){
            return res.status(400).json({
                success : false,
                message : "Code or language ID or User Token is Not found"
            });
        }

        const submissionToken = await getSubmissionsToken(code , language_id , stdin);

        const result = await getSubmissionResult(submissionToken);

        return res.status(200).json({
            success: true,
            topic_id,
            language_id,
            output : result.stdout,
            error :   result.stderr || result.compile_output,
            status : result.status,
            executionTime : result.time,
            memoryUsage : result.memory
        });

    }catch(err){
        console.error("API error:", err.message);
        return res.status(500).json({
           success : "error",
           message: "Failed to run code" });
    }
}