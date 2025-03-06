const express = require("express")
const router = express.Router()
const { sql, poolPromise } = require("../config/database")
const { hashPassword } = require("../utils/passwordUtils")
const { auth, checkRole } = require("../middleware/auth")
const bcrypt = require("bcryptjs")

// Get all users
router.get("/", auth, checkRole(["admin"]), async (req, res) => {
  try {
    const pool = await sql.connect()
    const result = await pool.request().query(`
        SELECT u.id, u.name, u.email, u.role, u.status, u.lastLogin, u.createdAt,
               COUNT(n.id) as articles
        FROM Users u
        LEFT JOIN News n ON u.id = n.authorId
        GROUP BY u.id, u.name, u.email, u.role, u.status, u.lastLogin, u.createdAt
        ORDER BY u.createdAt DESC
      `)

    res.json(result.recordset)
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Get single user
router.get("/:id", auth, async (req, res) => {
  try {
    // Only allow admin or the user themselves to view details
    if (req.user.role !== "admin" && req.user.id !== Number.parseInt(req.params.id)) {
      return res.status(403).json({ message: "Permission denied" })
    }

    const pool = await sql.connect()
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT u.id, u.name, u.email, u.role, u.status, u.lastLogin, u.createdAt,
               COUNT(n.id) as articles
        FROM Users u
        LEFT JOIN News n ON u.id = n.authorId
        WHERE u.id = @id
        GROUP BY u.id, u.name, u.email, u.role, u.status, u.lastLogin, u.createdAt
      `)

    if (!result.recordset[0]) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json(result.recordset[0])
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Update user
router.put("/:id", auth, async (req, res) => {
  try {
    // Only allow admin or the user themselves to update
    if (req.user.role !== "admin" && req.user.id !== Number.parseInt(req.params.id)) {
      return res.status(403).json({ message: "Permission denied" })
    }

    const { name, email, password, role, status } = req.body

    // Only admin can change roles and status
    if (req.user.role !== "admin" && (role || status)) {
      return res.status(403).json({ message: "Permission denied" })
    }

    const pool = await sql.connect()
    let query = `
      UPDATE Users
      SET name = @name,
          email = @email,
          updatedAt = @updatedAt
    `

    const request = pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("name", sql.VarChar, name)
      .input("email", sql.VarChar, email)
      .input("updatedAt", sql.DateTime, new Date())

    if (password) {
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)
      query += ", password = @password"
      request.input("password", sql.VarChar, hashedPassword)
    }

    if (req.user.role === "admin") {
      if (role) {
        query += ", role = @role"
        request.input("role", sql.VarChar, role)
      }
      if (status) {
        query += ", status = @status"
        request.input("status", sql.VarChar, status)
      }
    }

    query += " WHERE id = @id"
    const result = await request.query(query)

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "User updated successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Delete user
router.delete("/:id", auth, checkRole(["admin"]), async (req, res) => {
  try {
    const pool = await sql.connect()

    // Check if user has news articles
    const newsCheck = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT COUNT(*) as count FROM News WHERE authorId = @id")

    if (newsCheck.recordset[0].count > 0) {
      return res.status(400).json({
        message: "Cannot delete user with existing articles. Please reassign or delete the articles first.",
      })
    }

    const result = await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM Users WHERE id = @id")

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "User deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Get user profile
router.get("/profile", auth, async (req, res) => {
  try {
    const pool = await poolPromise
    const result = await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .query(`
        SELECT id, fullName, email, userType, gender, createdAt, lastLogin
        FROM Users
        WHERE id = @userId
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." })
    }

    res.json(result.recordset[0])
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
  }
})

// Update user profile
router.put("/profile", auth, async (req, res) => {
  try {
    const { fullName, gender } = req.body

    // Validate input
    if (!fullName) {
      return res.status(400).json({ message: "Ad Soyad alanı zorunludur." })
    }

    const pool = await poolPromise
    await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .input("fullName", sql.NVarChar, fullName)
      .input("gender", sql.NVarChar, gender)
      .input("updatedAt", sql.DateTime, new Date())
      .query(`
        UPDATE Users
        SET fullName = @fullName, 
            gender = @gender,
            updatedAt = @updatedAt
        WHERE id = @userId
      `)

    res.json({ message: "Profil başarıyla güncellendi." })
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
  }
})

// Change password
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Mevcut şifre ve yeni şifre gereklidir." })
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Şifre en az 6 karakter olmalıdır." })
    }

    const pool = await poolPromise

    // Get current user
    const userResult = await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .query("SELECT password FROM Users WHERE id = @userId")

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." })
    }

    // Verify current password
    const isMatch = await require("../utils/passwordUtils").comparePassword(
      currentPassword,
      userResult.recordset[0].password,
    )

    if (!isMatch) {
      return res.status(400).json({ message: "Mevcut şifre yanlış." })
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword)

    // Update password
    await pool
      .request()
      .input("userId", sql.Int, req.user.userId)
      .input("password", sql.NVarChar, hashedPassword)
      .input("updatedAt", sql.DateTime, new Date())
      .query(`
        UPDATE Users
        SET password = @password, updatedAt = @updatedAt
        WHERE id = @userId
      `)

    res.json({ message: "Şifre başarıyla değiştirildi." })
  } catch (error) {
    console.error("Change password error:", error)
    res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
  }
})

module.exports = router
