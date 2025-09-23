import scraperService from '../src/services/scrapperServices.js';
import aiContentService from '../src/services/aiContentServices.js';
import { generateEmbedding, cosineSimilarity } from '../src/utils/embeddings.js';

(async () => {
    try {
        console.log('Starting feature validation...');

        // Test scraping

        console.log("Using OpenRouter key:", process.env.OPENROUTER_API_KEY ? "Loaded ✅" : "Missing ❌");
        const testUrl = 'https://docs.python.org/3/tutorial/controlflow.html';
        const scrapedContent = await scraperService.scrapeContent(testUrl);
        console.log('Scraped Content:', scrapedContent.slice(0, 1000));

        // Test embedding generation
        const embedding = await generateEmbedding(scrapedContent);
        console.log('Generated Embedding:', embedding.slice(0, 5));

        // Test similarity
        const similarity = cosineSimilarity(embedding, embedding);
        console.log('Cosine Similarity (self):', similarity);

        // Test AI content generation
        const aiContent = await aiContentService.generateStoryContent(scrapedContent, 'Test Topic', 'Test Course');
        console.log('Generated AI Content:', aiContent);

        console.log('Feature validation completed successfully.');
    } catch (error) {
        console.error('Feature validation failed:', error);
    }
})();