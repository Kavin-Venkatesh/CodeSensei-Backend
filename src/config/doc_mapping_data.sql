-- Sample doc mapping for Python topics
-- This should be populated based on your actual topic IDs and corresponding documentation URLs

INSERT INTO doc_mapping (topic_id, official_doc_url) VALUES 
-- Basic Python topics
(1, 'https://docs.python.org/3/tutorial/introduction.html'),
(2, 'https://docs.python.org/3/tutorial/datastructures.html'),
(3, 'https://docs.python.org/3/tutorial/controlflow.html'),
(4, 'https://docs.python.org/3/tutorial/datastructures.html#more-on-lists'),
(5, 'https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences'),
(6, 'https://docs.python.org/3/tutorial/datastructures.html#dictionaries'),
(7, 'https://docs.python.org/3/tutorial/datastructures.html#sets'),
(8, 'https://docs.python.org/3/tutorial/inputoutput.html'),
(9, 'https://docs.python.org/3/tutorial/errors.html'),
(10, 'https://docs.python.org/3/tutorial/classes.html'),

-- Advanced Python topics
(11, 'https://docs.python.org/3/tutorial/modules.html'),
(12, 'https://docs.python.org/3/tutorial/stdlib.html'),
(13, 'https://docs.python.org/3/library/itertools.html'),
(14, 'https://docs.python.org/3/library/functools.html'),
(15, 'https://docs.python.org/3/library/collections.html'),
(16, 'https://docs.python.org/3/library/asyncio.html'),
(17, 'https://docs.python.org/3/tutorial/venv.html'),
(18, 'https://docs.python.org/3/library/unittest.html'),
(19, 'https://docs.python.org/3/library/logging.html'),
(20, 'https://docs.python.org/3/library/json.html'),

-- Web development topics
(21, 'https://docs.python.org/3/library/urllib.html'),
(22, 'https://docs.python.org/3/library/http.server.html'),
(23, 'https://docs.python.org/3/library/sqlite3.html'),
(24, 'https://docs.python.org/3/library/csv.html'),
(25, 'https://docs.python.org/3/library/xml.html')

ON DUPLICATE KEY UPDATE 
    official_doc_url = VALUES(official_doc_url),
    updated_at = CURRENT_TIMESTAMP;
