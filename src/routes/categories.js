const express = require("express")
const router = express.Router()
const { sql } = require("../config/database")
const { auth, checkRole } = require("../middleware/auth")

// Get all categories
router.get("/", async (req, res) => {
  try {
    const pool = await sql.connect()
    const result = await pool.request().query(`
        SELECT c.*, COUNT(n.id) as newsCount
        FROM Categories c
        LEFT JOIN News n ON c.id = n.categoryId
        GROUP BY c.id, c.name, c.slug, c.description, c.createdAt
        ORDER BY c.name
      `)

    res.json(result.recordset)
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Get single category
router.get("/:id", async (req, res) => {
  try {
    const pool = await sql.connect()
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT c.*, COUNT(n.id) as newsCount
        FROM Categories c
        LEFT JOIN News n ON c.id = n.categoryId
        WHERE c.id = @id
        GROUP BY c.id, c.name, c.slug, c.description, c.createdAt
      `)

    if (!result.recordset[0]) {
      return res.status(404).json({ message: "Category not found" })
    }

    res.json(result.recordset[0])
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Create category
router.post("/", auth, checkRole(["admin"]), async (req, res) => {
  try {
    const { name, slug, description } = req.body

    const pool = await sql.connect()

    // Check if slug exists
    const slugCheck = await pool
      .request()
      .input("slug", sql.VarChar, slug)
      .query("SELECT * FROM Categories WHERE slug = @slug")

    if (slugCheck.recordset.length > 0) {
      return res.status(400).json({ message: "Slug already exists" })
    }

    const result = await pool
      .request()
      .input("name", sql.VarChar, name)
      .input("slug", sql.VarChar, slug)
      .input("description", sql.VarChar, description)
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Categories (name, slug, description, createdAt)
        VALUES (@name, @slug, @description, @createdAt);
        SELECT SCOPE_IDENTITY() AS id;
      `)

    const categoryId = result.recordset[0].id

    res.status(201).json({
      message: "Category created successfully",
      category: {
        id: categoryId,
        name,
        slug,
        description,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Update category
router.put("/:id", auth, checkRole(["admin"]), async (req, res) => {
  try {
    const { name, slug, description } = req.body

    const pool = await sql.connect()

    // Check if slug exists (excluding current category)
    const slugCheck = await pool
      .request()
      .input("slug", sql.VarChar, slug)
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM Categories WHERE slug = @slug AND id != @id")

    if (slugCheck.recordset.length > 0) {
      return res.status(400).json({ message: "Slug already exists" })
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("name", sql.VarChar, name)
      .input("slug", sql.VarChar, slug)
      .input("description", sql.VarChar, description)
      .input("updatedAt", sql.DateTime, new Date())
      .query(`
        UPDATE Categories
        SET name = @name,
            slug = @slug,
            description = @description,
            updatedAt = @updatedAt
        WHERE id = @id
      `)

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Category not found" })
    }

    res.json({ message: "Category updated successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Delete category
router.delete("/:id", auth, checkRole(["admin"]), async (req, res) => {
  try {
    const pool = await sql.connect()

    // Check if category has news
    const newsCheck = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT COUNT(*) as count FROM News WHERE categoryId = @id")

    if (newsCheck.recordset[0].count > 0) {
      return res.status(400).json({
        message: "Cannot delete category with existing news. Please delete or move the news first.",
      })
    }

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Categories WHERE id = @id")

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Category not found" })
    }

    res.json({ message: "Category deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router

