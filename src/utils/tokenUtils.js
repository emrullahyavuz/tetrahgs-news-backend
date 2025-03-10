const jwt = require('jsonwebtoken');
const { pool, sql } = require('../config/database');
const { 
  JWT_SECRET, 
  JWT_REFRESH_SECRET, 
  JWT_EXPIRE, 
  JWT_REFRESH_EXPIRE 
} = require('../config/config');

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        userType: user.userType
      } 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRE }
  );
};

// Save refresh token to database
const saveRefreshToken = async (userId, refreshToken) => {
  try {
    const poolConnection = await pool;
    
    // Delete existing refresh tokens for this user
    await poolConnection.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM RefreshTokens WHERE userId = @userId');
    
    // Save new refresh token
    await poolConnection.request()
      .input('userId', sql.Int, userId)
      .input('token', sql.NVarChar, refreshToken)
      .input('expiresAt', sql.DateTime, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7 days
      .query(`
        INSERT INTO RefreshTokens (userId, token, expiresAt)
        VALUES (@userId, @token, @expiresAt)
      `);
    
    return true;
  } catch (err) {
    console.error('Refresh token kaydetme hatası:', err);
    throw err;
  }
};

// Verify refresh token
const verifyRefreshToken = async (refreshToken) => {
  try {
    // Verify token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Check if token exists in database
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('token', sql.NVarChar, refreshToken)
      .input('userId', sql.Int, decoded.userId)
      .query(`
        SELECT * FROM RefreshTokens 
        WHERE token = @token AND userId = @userId AND expiresAt > GETDATE()
      `);
    
    if (result.recordset.length === 0) {
      throw new Error('Geçersiz refresh token');
    }
    
    // Get user info
    const userResult = await poolConnection.request()
      .input('id', sql.Int, decoded.userId)
      .query('SELECT * FROM Users WHERE id = @id');
    
    if (userResult.recordset.length === 0) {
      throw new Error('Kullanıcı bulunamadı');
    }
    
    return userResult.recordset[0];
  } catch (err) {
    console.error('Refresh token doğrulama hatası:', err);
    throw err;
  }
};

// Delete refresh token
const deleteRefreshToken = async (refreshToken) => {
  try {
    const poolConnection = await pool;
    await poolConnection.request()
      .input('token', sql.NVarChar, refreshToken)
      .query('DELETE FROM RefreshTokens WHERE token = @token');
    
    return true;
  } catch (err) {
    console.error('Refresh token silme hatası:', err);
    throw err;
  }
};

// Delete all refresh tokens for a user
const deleteAllUserRefreshTokens = async (userId) => {
  try {
    const poolConnection = await pool;
    await poolConnection.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM RefreshTokens WHERE userId = @userId');
    
    return true;
  } catch (err) {
    console.error('Kullanıcı refresh tokenlarını silme hatası:', err);
    throw err;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  saveRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens
};