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
    question_id    INT NOT NULL,           -- FK → questions.id
    input          TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES practice_questions(question_id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS submissions (
    submission_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,           -- FK → users.id
    question_id     INT NOT NULL,           -- FK → questions.id
    code            TEXT NOT NULL,
    language        VARCHAR(50) NOT NULL,   -- e.g. javascript, python
    language_id     INT NOT NULL,           -- Judge0 language ID
    token           VARCHAR(100) NOT NULL,  -- Judge0 submission token
    stdout          TEXT,                    -- execution output
    stderr          TEXT,                    -- error output
    compile_output  TEXT,                    -- compilation errors
    status          VARCHAR(50) DEFAULT 'pending', -- pending / success / error
    time            FLOAT,                   -- execution time in seconds
    memory          INT,                     -- memory usage in bytes
    submitted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES practice_questions(question_id) ON DELETE CASCADE
);

