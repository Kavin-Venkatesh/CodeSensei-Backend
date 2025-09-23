import crypto, { hash } from 'crypto';

export const generateContentHash = (content) => {
    return crypto.createHash('sha256').update(content).digest('hex');
};


export const isContentSimilar = (hash1, hash2, threshold) => {
    return hash1 === hash2; // Simple equality check for now
}

export const normalizeContent = (content) => {
    return content
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/gi, '')
    .toLowerCase()
    .trim();
};

