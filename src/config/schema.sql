-- Database schema for CodeSensei content management system

-- Doc mapping table to store official documentation URLs for each topic
CREATE TABLE IF NOT EXISTS doc_mapping (
    topic_id INT PRIMARY KEY,
    official_doc_url VARCHAR(2048) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
);

-- AI-generated content table
CREATE TABLE IF NOT EXISTS ai_content (
    topic_id INT PRIMARY KEY,
    official_doc_content LONGTEXT,
    official_doc_hash VARCHAR(64),
    ai_explanation LONGTEXT,
    story_explanation LONGTEXT,
    content_version INT DEFAULT 1,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
);

-- Content sync log for tracking changes
CREATE TABLE IF NOT EXISTS content_sync_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    action_type ENUM('scraped', 'updated', 'generated', 'error') NOT NULL,
    old_hash VARCHAR(64),
    new_hash VARCHAR(64),
    content_version INT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
);

-- Scraper job queue for managing scraping tasks
CREATE TABLE IF NOT EXISTS scraper_jobs (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    priority INT DEFAULT 5,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_doc_mapping_topic ON doc_mapping(topic_id);
CREATE INDEX idx_ai_content_topic ON ai_content(topic_id);
CREATE INDEX idx_ai_content_hash ON ai_content(official_doc_hash);
CREATE INDEX idx_sync_log_topic ON content_sync_log(topic_id);
CREATE INDEX idx_sync_log_created ON content_sync_log(created_at);
CREATE INDEX idx_scraper_jobs_status ON scraper_jobs(status);
CREATE INDEX idx_scraper_jobs_priority ON scraper_jobs(priority);
