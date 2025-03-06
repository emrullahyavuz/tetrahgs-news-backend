const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const { sql, poolPromise } = require("../config/database")

// Generate access token (short-lived)
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }, // 1 hour expiration
  )
}

// Generate refresh token (long-lived)
const generateRefreshToken = async (userId, rememberMe = false) => {
  try {
    // Generate a random token
    const refreshToken = crypto.randomBytes(40).toString("hex")

    // Set expiration based on rememberMe flag
    const expiresAt = new Date()
    if (rememberMe) {
      // 30 days if remember me is checked
      expiresAt.setDate(expiresAt.getDate() + 30)
    } else {
      // 7 days by default
      expiresAt.setDate(expiresAt.getDate() + 7)
    }

    // Store refresh token in database
    const pool = await poolPromise
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("token", sql.NVarChar, refreshToken)
      .input("expiresAt", sql.DateTime, expiresAt)
      .query(`
        INSERT INTO RefreshTokens (userId, token, expiresAt, createdAt)
        VALUES (@userId, @token, @expiresAt, GETDATE())
      `)

    return { refreshToken, expiresAt }
  } catch (error) {
    console.error("Error generating refresh token:", error)
    throw error
  }
}

// Verify refresh token
const verifyRefreshToken = async (token) => {
  try {
    const pool = await poolPromise
    const result = await pool
      .request()
      .input("token", sql.NVarChar, token)
      .query(`
        SELECT rt.*, u.id as userId
        FROM RefreshTokens rt
        JOIN Users u ON rt.userId = u.id
        WHERE rt.token = @token AND rt.expiresAt > GETDATE()
      `)

    if (result.recordset.length === 0) {
      return null
    }

    return result.recordset[0]
  } catch (error) {
    console.error("Error verifying refresh token:", error)
    throw error
  }
}

// Delete refresh token
const deleteRefreshToken = async (token) => {
  try {
    const pool = await poolPromise
    await pool
      .request()
      .input("token", sql.NVarChar, token)
      .query(`
        DELETE FROM RefreshTokens
        WHERE token = @token
      `)
  } catch (error) {
    console.error("Error deleting refresh token:", error)
    throw error
  }
}

// Delete all refresh tokens for a user
const deleteAllUserRefreshTokens = async (userId) => {
  try {
    const pool = await poolPromise
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        DELETE FROM RefreshTokens
        WHERE userId = @userId
      `)
  } catch (error) {
    console.error("Error deleting user refresh tokens:", error)
    throw error
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
}

