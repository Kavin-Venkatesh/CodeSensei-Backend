

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export const aiConfig = {

   groq: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    temperature: 0.4,
    maxTokens: 2000,
    referer : "http://localhost:3000", // change in prod
    title: "CodeSensei",
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
if (!aiConfig.groq.apiKey) {
  throw new Error("❌ Missing GROQ_API_KEY in .env");
}

// Initialize Groq Client
export const groqClient = new OpenAI({
  apiKey: aiConfig.groq.apiKey,
  baseURL: aiConfig.groq.baseUrl,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // change in prod
    "X-Title": "CodeSensei",
  },
});
