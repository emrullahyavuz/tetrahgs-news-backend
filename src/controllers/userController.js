const { sql, poolPromise } = require("../config/database")
const { hashPassword } = require("../utils/passwordUtils")
const bcrypt = require("bcryptjs")

// Tüm kullanıcıları getir
exports.getAllUsers = async (req, res) => {
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
}

// Tek bir kullanıcıyı getir
exports.getUserById = async (req, res) => {
  try {
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
}

// Kullanıcıyı güncelle
exports.updateUser = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.id !== Number.parseInt(req.params.id)) {
      return res.status(403).json({ message: "Permission denied" })
    }

    const { name, email, password, role, status } = req.body
    if (req.user.role !== "admin" && (role || status)) {
      return res.status(403).json({ message: "Permission denied" })
    }

    const pool = await sql.connect()
    let query = `UPDATE Users SET name = @name, email = @email, updatedAt = @updatedAt`
    const request = pool.request()
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
      if (role) query += ", role = @role", request.input("role", sql.VarChar, role)
      if (status) query += ", status = @status", request.input("status", sql.VarChar, status)
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
}

// Kullanıcıyı sil
exports.deleteUser = async (req, res) => {
  try {
    const pool = await sql.connect()

    const newsCheck = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT COUNT(*) as count FROM News WHERE authorId = @id")

    if (newsCheck.recordset[0].count > 0) {
      return res.status(400).json({ message: "Cannot delete user with existing articles." })
    }

    const result = await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM Users WHERE id = @id")

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "User deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
}

// Kullanıcı profili getir
exports.getUserProfile = async (req, res) => {
  try {
    const pool = await poolPromise
    const result = await pool.request().input("userId", sql.Int, req.user.userId).query(`
      SELECT id, fullName, email, userType, gender, createdAt, lastLogin
      FROM Users WHERE id = @userId
    `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "User not found." })
    }

    res.json(result.recordset[0])
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
}

// Şifre değiştirme
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required." })
    }

    const pool = await poolPromise
    const userResult = await pool.request().input("userId", sql.Int, req.user.userId).query("SELECT password FROM Users WHERE id = @userId")

    if (!await bcrypt.compare(currentPassword, userResult.recordset[0].password)) {
      return res.status(400).json({ message: "Incorrect current password." })
    }

    const hashedPassword = await hashPassword(newPassword)
    await pool.request().input("userId", sql.Int, req.user.userId).input("password", sql.NVarChar, hashedPassword).query(`
      UPDATE Users SET password = @password WHERE id = @userId
    `)

    res.json({ message: "Password changed successfully." })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
}
