const express = require("express")
const router = express.Router()
const { sql } = require("../config/database")
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

module.exports = router

