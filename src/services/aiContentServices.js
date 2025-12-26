import { aiConfig } from "../config/aiConfig.js";
import pool from "../config/db.js";
import { generateEmbedding, cosineSimilarity } from "../utils/embeddings.js";
import { generateContentHash, normalizeContent } from "../utils/hash.js";
import scraperService from "./scrapperServices.js";
import { ExplanationPrompt } from "../utils/prompts.js";

class AIContentService {
  // ============================================================
  // 🧠 Generate AI content using Groq llama - 8B fetch API
  // ============================================================
  async generateStoryContent(officialContent, topicTitle, courseTitle) {
    try {
      const prompt = ExplanationPrompt(officialContent, topicTitle, courseTitle);

      const response = await fetch(`${aiConfig.groq.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiConfig.groq.apiKey}`,
          "HTTP-Referer": aiConfig.groq.referer,
          "X-Title": aiConfig.groq.title,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiConfig.groq.model,
          messages: [
            {
              role: "system",
              content: "you are a helpful assistant that generates clear and concise explanations based on provided content.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: aiConfig.groq.temperature,
          max_tokens: aiConfig.groq.maxTokens,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${errText}`);
      }

      const result = await response.json();

      // --- Extract content safely ---
      // let rawContent =
      //   result?.choices?.[0]?.message?.content ||
      //   result?.choices?.[0]?.message?.content?.[0]?.text ||
      //   "";

      // const finalText =
      //   typeof rawContent === "string"
      //     ? rawContent.trim()
      //     : Array.isArray(rawContent)
      //     ? rawContent.map((c) => c.text || "").join("\n").trim()
      //     : "";
      
      const finalText = result?.choices?.[0]?.message?.content?.trim() || "";

      if (!finalText) {
        throw new Error("Empty AI response from model");
      }

      return finalText;
    
    } catch (error) {
      console.error("Error generating AI content:", error);
      throw new Error(`AI content generation failed: ${error.message}`);
    }
  }

  async processContentUpdate(topicId, mappingId) {
    try {
      // 1️⃣ Fetch topic and mapping
      const [topicRows] = await pool.execute(
        `
        SELECT t.*, c.course_title, m.official_docs_url 
        FROM topics t 
        JOIN courses c ON t.course_id = c.course_id 
        JOIN docs_url_mapping m ON t.topic_id = m.topic_id
        WHERE t.topic_id = ? AND m.mapping_id = ? AND m.is_active = 1
      `,
        [topicId, mappingId]
      );

      if (topicRows.length === 0) throw new Error("Topic or mapping not found");

      const topic = topicRows[0];

      // 2️⃣ Set status = processing
      await pool.execute(
        `
        INSERT INTO ai_content (topic_id, mapping_id, status) 
        VALUES (?, ?, 'processing')
        ON DUPLICATE KEY UPDATE status = 'processing'
      `,
        [topicId, mappingId]
      );

      // 3️⃣ Scrape content
      const officialContent = await scraperService.scrapeContent(topic.official_docs_url);
      if (!officialContent || officialContent.length < 100) {
        throw new Error("Insufficient content scraped from URL");
      }

      // 4️⃣ Normalize + hash
      const normalized = normalizeContent(officialContent);
      const contentHash = generateContentHash(normalized);

      const [existingRows] = await pool.execute(
        `
        SELECT * FROM ai_content 
        WHERE topic_id = ? AND content_hash = ?
        ORDER BY last_updated_at DESC LIMIT 1
      `,
        [topicId, contentHash]
      );

      // --- Skip if content unchanged ---
      if (existingRows.length > 0) {
        await pool.execute(
          `
          UPDATE ai_content 
          SET last_scraped_at = CURRENT_TIMESTAMP,
              status = 'completed'
          WHERE topic_id = ? AND mapping_id = ?
        `,
          [topicId, mappingId]
        );

        return {
          changed: false,
          reason: "content_unchanged",
          content: {
            official_content: officialContent,
            ai_content: existingRows[0].ai_content,
          },
        };
      }

      const newEmbedding = await generateEmbedding(normalized);

      // 5️⃣ Compare similarity with previous embedding
      const [lastContentRows] = await pool.execute(
        `
        SELECT * FROM ai_content 
        WHERE topic_id = ? 
        ORDER BY last_updated_at DESC LIMIT 1
      `,
        [topicId]
      );

      let similarityScore = null;
      if (lastContentRows.length > 0) {
        const lastContent = lastContentRows[0];
        const oldEmbedding = JSON.parse(lastContent.embedding_vector || "[]");

        if (oldEmbedding.length > 0) {
          similarityScore = cosineSimilarity(oldEmbedding, newEmbedding);

          if (similarityScore > aiConfig.similarity.threshold) {
            await pool.execute(
              `
              UPDATE ai_content 
              SET last_scraped_at = CURRENT_TIMESTAMP,
                  similarity_score = ?,
                  status = 'completed'
              WHERE topic_id = ? AND mapping_id = ?
            `,
              [similarityScore, topicId, mappingId]
            );

            return {
              changed: false,
              reason: "high_similarity",
              similarity: similarityScore,
              content: {
                official_content: officialContent,
                ai_content: lastContent.ai_content,
              },
            };
          }
        }
      }

      // 6️⃣ Generate new AI explanation
      const aiContent = await this.generateStoryContent(
        officialContent,
        topic.topic_title,
        topic.course_title
      );

      // 7️⃣ Save in DB
      await pool.execute(
        `
        INSERT INTO ai_content (
          topic_id,
          mapping_id,
          official_content,
          ai_content,
          content_hash,
          embedding_vector,
          similarity_score,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
        ON DUPLICATE KEY UPDATE
          official_content = VALUES(official_content),
          ai_content = VALUES(ai_content),
          content_hash = VALUES(content_hash),
          embedding_vector = VALUES(embedding_vector),
          similarity_score = VALUES(similarity_score),
          status = VALUES(status),
          last_updated_at = CURRENT_TIMESTAMP
      `,
        [
          topicId,
          mappingId,
          officialContent,
          aiContent,
          contentHash,
          JSON.stringify(newEmbedding),
          similarityScore,
        ]
      );

      return {
        changed: true,
        similarity: similarityScore,
        content: {
          official_content: officialContent,
          ai_content: aiContent,
        },
      };
    } catch (error) {
      // 8️⃣ Log failure
      await pool.execute(
        `
        UPDATE ai_content 
        SET status = 'error',
            error_message = ?
        WHERE topic_id = ? AND mapping_id = ?
      `,
        [error.message, topicId, mappingId]
      );
      throw error;
    }
  }
}

export default new AIContentService();
