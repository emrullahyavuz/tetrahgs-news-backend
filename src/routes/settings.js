const express = require("express")
const router = express.Router()
const { sql } = require("../config/database")
const { auth, checkRole } = require("../middleware/auth")

// Get all settings
router.get("/", async (req, res) => {
  try {
    const pool = await sql.connect()
    const result = await pool.request().query("SELECT * FROM Settings")

    const settings = {}
    result.recordset.forEach((setting) => {
      settings[setting.key] = setting.value
    })

    res.json(settings)
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Update settings
router.put("/", auth, async (req, res) => {
  try {
    const settings = req.body
    const pool = await sql.connect()

    // Start a transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      for (const [key, value] of Object.entries(settings)) {
        await transaction
          .request()
          .input("key", sql.VarChar, key)
          .input("value", sql.VarChar, value)
          .input("updatedAt", sql.DateTime, new Date())
          .query(`
            UPDATE Settings
            SET value = @value, updatedAt = @updatedAt
            WHERE [key] = @key;
            
            IF @@ROWCOUNT = 0
            INSERT INTO Settings ([key], value, createdAt, updatedAt)
            VALUES (@key, @value, @updatedAt, @updatedAt)
          `)
      }

      await transaction.commit()
      res.json({ message: "Settings updated successfully" })
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router