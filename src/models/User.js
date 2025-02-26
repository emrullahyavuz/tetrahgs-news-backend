const { sql, poolPromise } = require('../config/db');

const getUserByEmail = async (email) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');
    return result.recordset[0];
  } catch (err) {
    console.error('SQL error', err);
    throw err;
  }
};

const createUser = async (user) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('email', sql.VarChar, user.email)
      .input('password', sql.VarChar, user.password)
      .query('INSERT INTO Users (email, password) VALUES (@email, @password)');
    return result;
  } catch (err) {
    console.error('SQL error', err);
    throw err;
  }
};

module.exports = {
  getUserByEmail,
  createUser,
};