import pool from "../config/db.js";

export const addCourse = async(req, res) => {
    try{
        const { course_title , description, language_id } = req.body;

        if( !course_title || !description || !language_id ){
            return res.status(400).json({
                success: false,
                message: 'course_title, description and language_id are required'
            });
        }

        const query = `
            INSERT INTO courses (course_title, description, language_id)
            VALUES (?, ?, ?)
        `;

        const [result] = await pool.execute(query, [course_title, description, language_id]);

        res.status(201).json({
            success: true,
            message: 'Course added successfully',
            data: {
                course_id: result.insertId,
                course_title,
                description,
                language_id
            }
        });
    } catch (error) {
        console.error('Error adding course:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while adding course',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });

    }
}

export const addTopics = async (req, res) => {
  const { course_id, topics } = req.body;

  // Basic request validation
  if (!course_id || !Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({
      message: "course_id and a non-empty topics array are required"
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Verify course exists
    const [courseCheck] = await connection.query(
      "SELECT course_id FROM courses WHERE course_id = ?",
      [course_id]
    );

    if (courseCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Course not found" });
    }

    const addedTopics = [];

    // 2️⃣ Loop through topics
    for (const topic of topics) {
      const {
        topic_title,
        topic_description = null,
        order_index,
        docs = []
      } = topic;

      // Topic validation
      if (!topic_title || order_index === undefined) {
        await connection.rollback();
        return res.status(400).json({
          message: "Each topic must have topic_title and order_index"
        });
      }

      // 3️⃣ Insert into topics table
      const [topicResult] = await connection.query(
        `
        INSERT INTO topics
        (course_id, topic_title, topic_description, order_index)
        VALUES (?, ?, ?, ?)
        `,
        [course_id, topic_title, topic_description, order_index]
      );

      const topicId = topicResult.insertId;

      // 4️⃣ Insert docs (bulk)
      if (docs.length > 0) {

        // Docs validation
        for (const doc of docs) {
          if (!doc.official_docs_url) {
            await connection.rollback();
            return res.status(400).json({
              message: "Each doc must have official_docs_url"
            });
          }
        }

        const docsValues = docs.map(doc => [
          topicId,
          topic_title,
          doc.official_docs_url,
          doc.priority ?? 1,
          doc.is_active ?? 1
        ]);

        await connection.query(
          `
          INSERT INTO docs_url_mapping
          (topic_id, topic_title, official_docs_url, priority, is_active)
          VALUES ?
          `,
          [docsValues]
        );
      }

      // 5️⃣ Prepare response data
      addedTopics.push({
        topic_id: topicId,
        topic_title,
        topic_description,
        order_index,
        docs: docs.map(doc => ({
          official_docs_url: doc.official_docs_url,
          priority: doc.priority ?? 1,
          is_active: doc.is_active ?? 1
        }))
      });
    }

    // 6️⃣ Commit transaction
    await connection.commit();

    return res.status(201).json({
      message: "Topics and docs added successfully",
      data: {
        course_id,
        topics: addedTopics
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error("Error inserting topics with docs:", error);

    return res.status(500).json({
      message: "Failed to insert topics and docs",
      error: error.message
    });

  } finally {
    connection.release();
  }
};
