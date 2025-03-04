const express = require("express")
const router = express.Router()
const { sql } = require("../config/database")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const auth = require("../middleware/auth")
const {checkRole} = require("../middleware/auth.js")

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    const pool = await sql.connect()
    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM Users WHERE email = @email")

    const user = result.recordset[0]

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Update last login
    await pool
      .request()
      .input("userId", sql.Int, user.id)
      .input("lastLogin", sql.DateTime, new Date())
      .query("UPDATE Users SET lastLogin = @lastLogin WHERE id = @userId")

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    })

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Register new user (admin only)
// router.post("/register", auth, checkRole(["admin"]), async (req, res) => {
//   try {
//     const { name, email, password, role } = req.body

//     const pool = await sql.connect()

//     // Check if user exists
//     const userCheck = await pool
//       .request()
//       .input("email", sql.VarChar, email)
//       .query("SELECT * FROM Users WHERE email = @email")

//     if (userCheck.recordset.length > 0) {
//       return res.status(400).json({ message: "User already exists" })
//     }

//     // Hash password
//     const salt = await bcrypt.genSalt(10)
//     const hashedPassword = await bcrypt.hash(password, salt)

//     // Create user
//     const result = await pool
//       .request()
//       .input("name", sql.VarChar, name)
//       .input("email", sql.VarChar, email)
//       .input("password", sql.VarChar, hashedPassword)
//       .input("role", sql.VarChar, role)
//       .input("status", sql.VarChar, "active")
//       .input("createdAt", sql.DateTime, new Date())
//       .query(`
//         INSERT INTO Users (name, email, password, role, status, createdAt)
//         VALUES (@name, @email, @password, @role, @status, @createdAt);
//         SELECT SCOPE_IDENTITY() AS id;
//       `)

//     const userId = result.recordset[0].id

//     res.status(201).json({
//       message: "User created successfully",
//       user: {
//         id: userId,
//         name,
//         email,
//         role,
//       },
//     })
//   } catch (error) {
//     res.status(500).json({ message: "Server error" })
//   }
// })

module.exports = router

