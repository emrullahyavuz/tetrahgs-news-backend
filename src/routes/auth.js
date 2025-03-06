const express = require("express")
const router = express.Router()
const { sql, poolPromise } = require("../config/database")
const { hashPassword, comparePassword } = require("../utils/passwordUtils")
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
} = require("../utils/tokenUtils")
const { auth } = require("../middleware/auth.js")
const {checkRole} = require("../middleware/auth.js")
const bcrypt = require("bcryptjs") // Import bcrypt

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, userType, gender } = req.body

    // Validate input (basic validation, frontend has Yup validation)
    if (!fullName || !email || !password || !userType || !gender) {
      return res.status(400).json({ message: "Tüm alanları doldurunuz." })
    }

    // Check if email already exists
    const pool = await poolPromise
    const userCheck = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE email = @email")

    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ message: "Bu email adresi zaten kullanılıyor." })
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Insert new user
    const result = await pool
      .request()
      .input("fullName", sql.NVarChar, fullName)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .input("userType", sql.NVarChar, userType)
      .input("gender", sql.NVarChar, gender)
      .query(`
        INSERT INTO Users (fullName, email, password, userType, gender, createdAt)
        VALUES (@fullName, @email, @password, @userType, @gender, GETDATE());
        SELECT SCOPE_IDENTITY() AS id;
      `)

    const userId = result.recordset[0].id

    // Generate tokens
    const accessToken =  generateAccessToken(userId)
    const { refreshToken } = await generateRefreshToken(userId)

    res.status(201).json({
      message: "Kullanıcı başarıyla oluşturuldu.",
      user: {
        id: userId,
        fullName,
        email,
        userType,
        gender,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error("Register error:", error)
    res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email ve şifre gereklidir." })
    }

    // Check if user exists
    const pool = await poolPromise
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE email = @email")

    const user = result.recordset[0]

    if (!user) {
      return res.status(401).json({ message: "Geçersiz email veya şifre." })
    }

    // Check password
    const isMatch = await comparePassword(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Geçersiz email veya şifre." })
    }

    // Update last login
    await pool
      .request()
      .input("userId", sql.Int, user.id)
      .query("UPDATE Users SET lastLogin = GETDATE() WHERE id = @userId")

    // Generate tokens
    const accessToken = generateAccessToken(user.id)
    const { refreshToken } = await generateRefreshToken(user.id, rememberMe)

    res.json({
      message: "Giriş başarılı.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        gender: user.gender,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
  }
})

// Register new user (admin only)
router.post("/register-admin", auth, checkRole(["admin"]), async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    const pool = await poolPromise

    // Check if user exists
    const userCheck = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM Users WHERE email = @email")

    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ message: "User already exists" })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create user
    const result = await pool
      .request()
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, hashedPassword)
      .input("role", sql.VarChar, role)
      .input("status", sql.VarChar, "active")
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Users (name, email, password, role, status, createdAt)
        VALUES (@name, @email, @password, @role, @status, @createdAt);
        SELECT SCOPE_IDENTITY() AS id;
      `)

    const userId = result.recordset[0].id

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: userId,
        name,
        email,
        role,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router

