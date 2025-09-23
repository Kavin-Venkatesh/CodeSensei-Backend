// import { GoogleGenerativeAI } from '@google/generative-ai';
// import OpenAI from 'openai';

// export const aiConfig = {
//     // gemini: {
//     //     apiKey: process.env.GEMINI_API_KEY,
//     //     model: 'gemini-2.0-flash'
//     // },

//     openrouter: {
//         apiKey: process.env.OPENAI_API_KEY,
//         baseUrl: "https://openrouter.ai/api/v1",
//         model: "x-ai/grok-4-fast:free"
//     },

//     embedding: {
//         provider: 'cohere',
//         model: 'embed-english-v3.0'
//     },
//     similarity: {
//         threshold: 0.95,
//         minContentLength: 100
//     },
//     scraping: {
//         timeout: 30000,
//         retryAttempts: 3,
//         userAgent: 'CodeSensei-Bot/1.0'
//     }
// };

// // Initialize Gemini AI
// // export const genAI = new GoogleGenerativeAI(aiConfig.gemini.apiKey);
// // export const model = genAI.getGenerativeModel({ model: aiConfig.gemini.model });

// export const openRouterClient = new OpenAI({
//   apiKey: aiConfig.openrouter.apiKey,
//   baseURL: "https://openrouter.ai/api/v1",
//   defaultHeaders: {
//     "HTTP-Referer": "http://localhost:3000",
//     "X-Title": "CodeSensei"
//   }
// });


import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

export const aiConfig = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY, // ✅ correct variable
    baseUrl: "https://openrouter.ai/api/v1",
    model: "x-ai/grok-4-fast:free",
  },

  embedding: {
    provider: "cohere",
    model: "embed-english-v3.0",
  },
  similarity: {
    threshold: 0.95,
    minContentLength: 100,
  },
  scraping: {
    timeout: 30000,
    retryAttempts: 3,
    userAgent: "CodeSensei-Bot/1.0",
  },
};

// Fail fast if API key is missing
if (!aiConfig.openrouter.apiKey) {
  throw new Error("❌ Missing OPENROUTER_API_KEY in .env");
}

// Initialize OpenRouter Client
export const openRouterClient = new OpenAI({
  apiKey: aiConfig.openrouter.apiKey, // ✅ fixed
  baseURL: aiConfig.openrouter.baseUrl,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // change in prod
    "X-Title": "CodeSensei",
  },
});
