CREATE TABLE course_progress (
  user_id INT NOT NULL,
  topic_id INT NOT NULL,
  is_completed BOOLEAN DEFAULT 0,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (user_id, topic_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS practice_questions (
    question_id      INT AUTO_INCREMENT PRIMARY KEY,
    question_title   VARCHAR(255) NOT NULL,
    question_description TEXT NOT NULL,
    sample_input     TEXT,
    sample_output    TEXT,
    explanation      TEXT,
    created_by       INT,                  
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS test_cases (
    test_id        INT AUTO_INCREMENT PRIMARY KEY,
    question_id    INT NOT NULL,          -- FK → questions.id 
    input          TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES practice_questions(question_id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS submissions (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    question_id   INT NOT NULL,
    code          TEXT NOT NULL,
    language      VARCHAR(50) NOT NULL,
    language_id   INT NOT NULL,
    submitted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES practice_questions(question_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_question (user_id, question_id)
);

