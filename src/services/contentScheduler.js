import cron from 'node-cron';
import scraperService from './scrapperServices.js';
import aiContentService from './aiContentServices.js';
import pool from '../config/db.js';

class ContentScheduler {
    constructor() {
        // Schedule main update job (daily at midnight)
        this.updateJob = cron.schedule('0 0 * * *', () => {
            this.runContentUpdates();
        });

        // Schedule cleanup job (weekly on Sunday at 1 AM)
        this.cleanupJob = cron.schedule('0 1 * * 0', () => {
            this.cleanupOldContent();
        });
    }

    async runContentUpdates() {
        console.log('Starting scheduled content updates:', new Date().toISOString());
        
        try {
            // Check for docs updates
            const docsToUpdate = await scraperService.checkDocsForUpdate();
            console.log(`Found ${docsToUpdate.length} docs to check for updates`);

            // Process each doc that needs updating
            for (const doc of docsToUpdate) {
                if (doc.success) {
                    try {
                        await aiContentService.processContentUpdate(doc.topic_id, doc.mapping_id);
                        console.log(`Successfully updated content for topic: ${doc.topic_title}`);
                    } catch (error) {
                        console.error(`Error updating content for topic ${doc.topic_title}:`, error);
                    }
                }
            }

            // Log completion
            await this.logUpdateRun(docsToUpdate);

        } catch (error) {
            console.error('Error during scheduled content update:', error);
            // Log the error to database
            await pool.execute(
                'INSERT INTO update_logs (status, error_message) VALUES (?, ?)',
                ['error', error.message]
            );
        }
    }

    async cleanupOldContent() {
        try {
            // Keep only the 3 most recent versions for each topic
            await pool.execute(`
                DELETE ac1 FROM ai_content ac1
                LEFT JOIN (
                    SELECT topic_id, mapping_id, last_updated_at
                    FROM ai_content
                    ORDER BY last_updated_at DESC
                    LIMIT 3
                ) ac2 ON ac1.topic_id = ac2.topic_id AND ac1.mapping_id = ac2.mapping_id
                WHERE ac2.topic_id IS NULL
            `);

            // Log cleanup
            await pool.execute(
                'INSERT INTO update_logs (type, status) VALUES (?, ?)',
                ['cleanup', 'completed']
            );

        } catch (error) {
            console.error('Error during content cleanup:', error);
            await pool.execute(
                'INSERT INTO update_logs (type, status, error_message) VALUES (?, ?, ?)',
                ['cleanup', 'error', error.message]
            );
        }
    }

    async logUpdateRun(results) {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        await pool.execute(
            'INSERT INTO update_logs (type, status, details) VALUES (?, ?, ?)',
            ['update', 'completed', JSON.stringify({
                total: results.length,
                successful,
                failed,
                timestamp: new Date().toISOString()
            })]
        );
    }

    // Manual trigger for testing or forced updates
    async triggerUpdate() {
        await this.runContentUpdates();
    }

    // Stop the scheduler
    stop() {
        if (this.updateJob) {
            this.updateJob.stop();
        }
        if (this.cleanupJob) {
            this.cleanupJob.stop();
        }
    }
}

export default new ContentScheduler();