// import { model } from '../config/aiConfig.js';
// import pool from '../config/db.js';
// import { generateEmbedding, cosineSimilarity } from '../utils/embeddings.js';
// import { generateContentHash, normalizeContent } from '../utils/hash.js';
// import scraperService from './scrapperServices.js';

// class AIContentService {
//     async generateStoryContent(officialContent, topicTitle, courseTitle) {
//         try {
//             const prompt = `
//                 You are an expert programming educator who creates engaging, story-driven explanations for technical concepts.

//                 Course: ${courseTitle}
//                 Topic: ${topicTitle}

//                 Official Documentation Content:
//                 ${officialContent}

//                 Create an engaging, story-style explanation that:
//                 1. Uses relatable analogies and real-world examples
//                 2. Breaks down complex concepts into digestible parts
//                 3. Maintains technical accuracy while being accessible
//                 4. Includes practical examples and use cases
//                 5. Follows a narrative structure that keeps readers engaged
//                 6. Is approximately 800-1200 words

//                 Format the response as clean markdown.
//             `;

//             // Optimize by using a streaming response if supported
//             const result = await model.generateContent(prompt, { stream: true });

//             if (result[Symbol.asyncIterator]) {
//                 // Handle streaming response
//                 let responseText = '';
//                 for await (const chunk of result) {
//                     responseText += chunk.text;
//                 }
//                 return responseText;
//             } else {
//                 // Handle non-streaming response
//                 return result.text || '';
//             }
//         } catch (error) {
//             console.error('Error generating AI content:', error);
//             throw new Error(`AI content generation failed: ${error.message}`);
//         }
//     }

//     async processContentUpdate(topicId, mappingId) {
//         try {
//             // Get topic and mapping details
//             const [topicRows] = await pool.execute(`
//                 SELECT t.*, c.course_title, m.official_docs_url 
//                 FROM topics t 
//                 JOIN courses c ON t.course_id = c.course_id 
//                 JOIN docs_url_mapping m ON t.topic_id = m.topic_id
//                 WHERE t.topic_id = ? AND m.mapping_id = ? AND m.is_active = 1
//             `, [topicId, mappingId]);

//             if (topicRows.length === 0) {
//                 throw new Error('Topic or mapping not found');
//             }

//             const topic = topicRows[0];

//             // Update status to processing
//             await pool.execute(`
//                 INSERT INTO ai_content (topic_id, mapping_id, status) 
//                 VALUES (?, ?, 'processing')
//                 ON DUPLICATE KEY UPDATE status = 'processing'
//             `, [topicId, mappingId]);

//             // Scrape content
//             const officialContent = await scraperService.scrapeContent(topic.official_docs_url);

//             if (!officialContent || officialContent.length < 100) {
//                 throw new Error('Insufficient content scraped from URL');
//             }

//             // Generate hash and embedding
//             const normalizedContent = normalizeContent(officialContent);
//             const contentHash = generateContentHash(normalizedContent);

//             // Check if content has changed
//             const [existingRows] = await pool.execute(`
//                 SELECT * FROM ai_content 
//                 WHERE topic_id = ? AND content_hash = ?
//                 ORDER BY last_updated_at DESC LIMIT 1
//             `, [topicId, contentHash]);

//             if (existingRows.length > 0) {
//                 // Content hasn't changed, update last_scraped_at
//                 await pool.execute(`
//                     UPDATE ai_content 
//                     SET last_scraped_at = CURRENT_TIMESTAMP,
//                         status = 'completed'
//                     WHERE topic_id = ? AND mapping_id = ?
//                 `, [topicId, mappingId]);

//                 return {
//                     changed: false,
//                     reason: 'content_unchanged'
//                 };
//             }

//             // Generate embedding for similarity check
//             const newEmbedding = await generateEmbedding(normalizedContent);

//             // Get last content for similarity comparison
//             const [lastContentRows] = await pool.execute(`
//                 SELECT * FROM ai_content 
//                 WHERE topic_id = ? 
//                 ORDER BY last_updated_at DESC LIMIT 1
//             `, [topicId]);

//             let similarityScore = null;
//             if (lastContentRows.length > 0) {
//                 const lastContent = lastContentRows[0];
//                 const oldEmbedding = JSON.parse(lastContent.embedding_vector || '[]');
//                 if (oldEmbedding.length > 0) {
//                     similarityScore = cosineSimilarity(oldEmbedding, newEmbedding);

//                     // If content is very similar, skip update
//                     if (similarityScore > 0.95) {
//                         await pool.execute(`
//                             UPDATE ai_content 
//                             SET last_scraped_at = CURRENT_TIMESTAMP,
//                                 similarity_score = ?,
//                                 status = 'completed'
//                             WHERE topic_id = ? AND mapping_id = ?
//                         `, [similarityScore, topicId, mappingId]);

//                         return {
//                             changed: false,
//                             reason: 'high_similarity',
//                             similarity: similarityScore
//                         };
//                     }
//                 }
//             }

//             // Generate new AI content
//             const aiContent = await this.generateStoryContent(
//                 officialContent,
//                 topic.topic_title,
//                 topic.course_title
//             );

//             // Save new content
//             await pool.execute(`
//                 INSERT INTO ai_content (
//                     topic_id,
//                     mapping_id,
//                     official_content,
//                     ai_content,
//                     content_hash,
//                     embedding_vector,
//                     similarity_score,
//                     status
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
//                 ON DUPLICATE KEY UPDATE
//                     official_content = VALUES(official_content),
//                     ai_content = VALUES(ai_content),
//                     content_hash = VALUES(content_hash),
//                     embedding_vector = VALUES(embedding_vector),
//                     similarity_score = VALUES(similarity_score),
//                     status = VALUES(status),
//                     last_updated_at = CURRENT_TIMESTAMP
//             `, [
//                 topicId,
//                 mappingId,
//                 officialContent,
//                 aiContent,
//                 contentHash,
//                 JSON.stringify(newEmbedding),
//                 similarityScore
//             ]);

//             return {
//                 changed: true,
//                 similarity: similarityScore,
//                 contentLength: officialContent.length,
//                 aiContentLength: aiContent.length
//             };

//         } catch (error) {
//             // Update status to error
//             await pool.execute(`
//                 UPDATE ai_content 
//                 SET status = 'error',
//                     error_message = ?
//                 WHERE topic_id = ? AND mapping_id = ?
//             `, [error.message, topicId, mappingId]);

//             throw error;
//         }
//     }
// }

// export default new AIContentService();



import { openRouterClient, aiConfig } from "../config/aiConfig.js";
import pool from "../config/db.js";
import { generateEmbedding, cosineSimilarity } from "../utils/embeddings.js";
import { generateContentHash, normalizeContent } from "../utils/hash.js";
import scraperService from "./scrapperServices.js";
import { ExplanationPrompt } from "../utils/prompts.js";

class AIContentService {
  async generateStoryContent(officialContent, topicTitle, courseTitle) {
    try {
      const prompt = ExplanationPrompt(officialContent, topicTitle, courseTitle);

      const completion = await openRouterClient.chat.completions.create({
        model: aiConfig.openrouter.model,
        messages: [{ role: "user", content: prompt }],
      });

      return completion.choices?.[0]?.message?.content?.trim() || "";
    } catch (error) {
      console.error("Error generating AI content:", error);
      throw new Error(`AI content generation failed: ${error.message}`);
    }
  }

  async processContentUpdate(topicId, mappingId) {
    try {
      // 1. Get topic + mapping details
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

      if (topicRows.length === 0) {
        throw new Error("Topic or mapping not found");
      }

      const topic = topicRows[0];

      // 2. Mark status → processing
      await pool.execute(
        `
        INSERT INTO ai_content (topic_id, mapping_id, status) 
        VALUES (?, ?, 'processing')
        ON DUPLICATE KEY UPDATE status = 'processing'
      `,
        [topicId, mappingId]
      );

      // 3. Scrape docs
      const officialContent = await scraperService.scrapeContent(
        topic.official_docs_url
      );
      if (!officialContent || officialContent.length < 100) {
        throw new Error("Insufficient content scraped from URL");
      }

      // 4. Hash + embedding
      const normalizedContent = normalizeContent(officialContent);
      const contentHash = generateContentHash(normalizedContent);

      const [existingRows] = await pool.execute(
        `
        SELECT * FROM ai_content 
        WHERE topic_id = ? AND content_hash = ?
        ORDER BY last_updated_at DESC LIMIT 1
      `,
        [topicId, contentHash]
      );

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

      const newEmbedding = await generateEmbedding(normalizedContent);

      // 5. Check similarity with last version
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

      // 6. Generate new AI content
      const aiContent = await this.generateStoryContent(
        officialContent,
        topic.topic_title,
        topic.course_title
      );

      if (!aiContent) {
        throw new Error("AI model returned empty content");
      }

      // 7. Save to DB
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
