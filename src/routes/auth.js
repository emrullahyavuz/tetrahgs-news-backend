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
const {register, login} = require("../controllers/authController.js")

// Register a new user
router.post("/register",register)

// Login
router.post("/login",login)

// Register new user (admin only)
// router.post("/register-admin", auth, checkRole(["admin"]), async (req, res) => {
//   try {
//     const { name, email, password, role } = req.body

//     const pool = await poolPromise

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

//     const resultStatus = result.rowsAffected[0] > 0 ? "true" : "false";

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

