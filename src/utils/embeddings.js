import {CohereClient} from 'cohere-ai';

const cohere = new CohereClient({
    token : process.env.COHERE_API_KEY
})

export const generateEmbedding = async (texts) => {
    try {
        // Batch embedding requests for efficiency
        const response = await cohere.embed({
            model: 'embed-english-v3.0',
            texts: Array.isArray(texts) ? texts : [texts],
            inputType: 'search_document'
        });

        return Array.isArray(texts) ? response.embeddings : response.embeddings[0];
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
};

export const cosineSimilarity = (vecA, vecB) => {
    if( vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for(let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if(normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

