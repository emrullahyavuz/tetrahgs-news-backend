const { sql, poolPromise } = require('../config/db');

const getBlogs = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Blogs');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};


const getBlogById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Blogs WHERE id = @id');
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getBlogs,
  getBlogById,
};