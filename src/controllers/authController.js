const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { pool, sql } = require("../config/database")

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your_refresh_secret"
const JWT_EXPIRE = process.env.JWT_EXPIRE || "1d"

// Token oluştur
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE },
  )
}

// Refresh token oluştur
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }, // Refresh token daha uzun süreli olmalı
  )
}

// Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email ve şifre gereklidir",
      })
    }

    const poolConnection = await pool

    // Check if user exists with role information
    const result = await poolConnection
      .request()
      .input("email", sql.NVarChar, email)
      .query(`
        SELECT u.*, r.roleName 
        FROM Users u
        LEFT JOIN Roles r ON u.role = r.roleId
        WHERE u.email = @email
      `)

    if (result.recordset.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz email veya şifre",
      })
    }

    const user = result.recordset[0]

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz email veya şifre",
      })
    }

    // Update last login
    await poolConnection
      .request()
      .input("id", sql.Int, user.id)
      .input("lastLogin", sql.DateTime, new Date())
      .query("UPDATE Users SET lastLogin = @lastLogin WHERE id = @id")

    // Generate tokens
    const token = generateToken(user)
    const refreshToken = generateRefreshToken(user)

    // Remove password from response
    delete user.password

    res.json({
      success: true,
      message: "Giriş başarılı",
      user,
      token,
      refreshToken,
    })
  } catch (err) {
    console.error("Login hatası:", err)
    next(err)
  }
}

// Refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token gereklidir",
      })
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET)

    // Get user
    const poolConnection = await pool
    const result = await poolConnection
      .request()
      .input("id", sql.Int, decoded.id)
      .query(`
        SELECT u.*, r.roleName 
        FROM Users u
        LEFT JOIN Roles r ON u.role = r.roleId
        WHERE u.id = @id
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      })
    }

    const user = result.recordset[0]

    // Generate new token
    const token = generateToken(user)
    const newRefreshToken = generateRefreshToken(user)

    res.json({
      success: true,
      token,
      refreshToken: newRefreshToken,
    })
  } catch (err) {
    console.error("Refresh token hatası:", err)
    return res.status(401).json({
      success: false,
      message: "Geçersiz veya süresi dolmuş token",
    })
  }
}

// Logout
exports.logout = async (req, res) => {
  // Client tarafında token'ları silmek yeterli olacaktır
  res.json({
    success: true,
    message: "Çıkış başarılı",
  })
}

// Logout from all devices
exports.logoutAll = async (req, res) => {
  // Gerçek uygulamada, veritabanında kullanıcının tüm refresh token'larını geçersiz kılabilirsiniz
  res.json({
    success: true,
    message: "Tüm cihazlardan çıkış yapıldı",
  })
}

// Get current user
exports.getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.id
    

    const poolConnection = await pool

    // Get user with role information
    const result = await poolConnection
      .request()
      .input("id", sql.Int, userId)
      .query(`
        SELECT u.id, u.fullName, u.email, u.role as roleId, r.roleName, 
               u.createdAt, u.lastLogin, u.profileImage
        FROM Users u
        LEFT JOIN Roles r ON u.role = r.roleId
        WHERE u.id = @id
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      })
    }

    const user = result.recordset[0]

    res.json({
      success: true,
      user,
    })
  } catch (err) {
    console.error("Kullanıcı bilgileri getirme hatası:", err)
    next(err)
  }
}

// Register user
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body

    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Ad Soyad, email ve şifre gereklidir",
      })
    }

    const poolConnection = await pool

    // Check if user already exists
    const checkResult = await poolConnection
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE email = @email")

    if (checkResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Bu email adresi zaten kullanılıyor",
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create user
    const result = await poolConnection
      .request()
      .input("fullName", sql.NVarChar, fullName)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .input("role", sql.Int, 3) // Default role: User (3)
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Users (fullName, email, password, role, createdAt)
        VALUES (@fullName, @email, @password, @role, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `)

    const userId = result.recordset[0].id

    // Get user with role information
    const userResult = await poolConnection
      .request()
      .input("id", sql.Int, userId)
      .query(`
        SELECT u.id, u.fullName, u.email, u.role as roleId, r.roleName, u.createdAt
        FROM Users u
        LEFT JOIN Roles r ON u.role = r.roleId
        WHERE u.id = @id
      `)

    const user = userResult.recordset[0]

    // Generate token
    const token = generateToken(user)
    const refreshToken = generateRefreshToken(user)

    res.status(201).json({
      success: true,
      message: "Kayıt başarılı",
      user,
      token,
      refreshToken,
    })
  } catch (err) {
    console.error("Kayıt hatası:", err)
    next(err)
  }
}

