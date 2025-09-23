import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { aiConfig } from '../config/aiConfig.js';
import pool from '../config/db.js';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

class ScraperService {
    constructor() {
        this.browser = null;
    }

    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
        return this.browser;
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async scrapeWithAxios(url) {
        try {
            const response = await axios.get(url, {
                timeout: aiConfig.scraping.timeout,
                headers: {
                    'User-Agent': aiConfig.scraping.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            // Optimize content extraction by prioritizing Readability
            const dom = new JSDOM(response.data);
            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            if (article && article.textContent.length > 100) {
                return this.normalizeContent(article.textContent);
            }

            // Fallback to cheerio if Readability fails
            const $ = cheerio.load(response.data);
            return this.cleanContent($);
        } catch (error) {
            console.error(`Axios scraping failed for URL: ${url}`, error);
            throw new Error(`Axios scraping failed: ${error.message}`);
        }
    }

    cleanContent($) {
        // Remove unwanted elements
        $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, .comments, .related-articles').remove();
        
        // Extract main content
        let content = '';
        
        // Try common content selectors for documentation sites
        const contentSelectors = [
            'main',
            '[role="main"]',
            '.content',
            '.main-content',
            '.documentation',
            '.docs-content',
            '.markdown-body', // GitHub-style docs
            '.article-content',
            '.post-content',
            '.entry-content',
            'article'
        ];

        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                content = element.text();
                break;
            }
        }

        // Fallback to body if no content found
        if (!content) {
            content = $('body').text();
        }

        return this.normalizeContent(content);
    }

    normalizeContent(content) {
        return content
            .replace(/\s+/g, ' ') // Collapse whitespace
            .replace(/[\r\n]+/g, '\n') // Normalize line breaks
            .replace(/[^\S\r\n]+/g, ' ') // Convert multiple spaces to single space
            .replace(/\n\s*\n/g, '\n\n') // Remove multiple empty lines
            .replace(/[^\w\s\n.,!?;:()"'-]/g, '') // Remove special characters but keep basic punctuation
            .trim();
    }

    async scrapeContent(url, retryCount = 0) {
        try {
            const content = await this.scrapeWithAxios(url);
            
            if (!content || content.length < aiConfig.similarity.minContentLength) {
                throw new Error('Insufficient content scraped');
            }
            
            return content;
        } catch (axiosError) {
            if (retryCount < aiConfig.scraping.retryAttempts) {
                console.warn(`Retry ${retryCount + 1} for ${url}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                return this.scrapeContent(url, retryCount + 1);
            }

            // If all retries fail, try Puppeteer as fallback
            try {
                const browser = await this.initBrowser();
                const page = await browser.newPage();
                await page.goto(url, { waitUntil: 'networkidle0', timeout: aiConfig.scraping.timeout });
                const content = await page.evaluate(() => document.body.innerText);
                await this.closeBrowser();
                return this.normalizeContent(content);
            } catch (puppeteerError) {
                throw new Error(`Scraping failed: ${axiosError.message}. Puppeteer fallback also failed: ${puppeteerError.message}`);
            }
        }
    }

    async checkDocsForUpdate() {
        try {
            const [mappings] = await pool.execute(`
                SELECT 
                    m.*,
                    t.topic_title,
                    COALESCE(ac.last_scraped_at, '1970-01-01') as last_check
                FROM docs_url_mapping m
                JOIN topics t ON m.topic_id = t.topic_id
                LEFT JOIN ai_content ac ON m.topic_id = ac.topic_id
                WHERE m.is_active = 1
                ORDER BY ac.last_scraped_at ASC, m.priority DESC
            `);

            const results = [];
            for (const mapping of mappings) {
                try {
                    const hoursSinceLastCheck = (Date.now() - new Date(mapping.last_check)) / (1000 * 60 * 60);
                    if (hoursSinceLastCheck < 24 && mapping.last_check !== '1970-01-01') {
                        continue; // Skip if checked in last 24 hours
                    }

                    const content = await this.scrapeContent(mapping.official_docs_url);
                    results.push({
                        mapping_id: mapping.mapping_id,
                        topic_id: mapping.topic_id,
                        topic_title: mapping.topic_title,
                        success: true,
                        contentLength: content.length
                    });
                } catch (error) {
                    console.error(`Error scraping ${mapping.topic_title}:`, error);
                    results.push({
                        mapping_id: mapping.mapping_id,
                        topic_id: mapping.topic_id,
                        topic_title: mapping.topic_title,
                        success: false,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error checking docs for updates:', error);
            throw error;
        }
    }
}

export default new ScraperService();