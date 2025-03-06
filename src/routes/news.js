const express = require("express")
const router = express.Router()
const { sql } = require("../config/database")
const { auth, checkRole } = require("../middleware/auth")
const upload = require("../middleware/upload")

// Get all news with pagination and filters
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, category, status, search } = req.query
    const offset = (page - 1) * limit

    let query = `
      SELECT n.*, c.name as categoryName, u.name as authorName
      FROM News n
      LEFT JOIN Categories c ON n.categoryId = c.id
      LEFT JOIN Users u ON n.authorId = u.id
      WHERE 1=1
    `
    const params = {}

    if (category) {
      query += " AND n.categoryId = @categoryId"
      params.categoryId = category
    }

    if (status) {
      query += " AND n.status = @status"
      params.status = status
    }

    if (search) {
      query += " AND (n.title LIKE @search OR n.summary LIKE @search)"
      params.search = `%${search}%`
    }

    query += ` ORDER BY n.createdAt DESC
               OFFSET @offset ROWS
               FETCH NEXT @limit ROWS ONLY`

    const pool = await sql.connect()
    const request = pool.request()

    // Add parameters to request
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value)
    })
    request.input("offset", sql.Int, offset)
    request.input("limit", sql.Int, Number.parseInt(limit))

    const result = await request.query(query)

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM News n
      WHERE 1=1
      ${category ? "AND n.categoryId = @categoryId" : ""}
      ${status ? "AND n.status = @status" : ""}
      ${search ? "AND (n.title LIKE @search OR n.summary LIKE @search)" : ""}
    `
    const countResult = await request.query(countQuery)
    const total = countResult.recordset[0].total

    res.json({
      news: result.recordset,
      pagination: {
        total,
        page: Number.parseInt(page),
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Get single news
router.get("/:id", async (req, res) => {
  try {
    const pool = await sql.connect()
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT n.*, c.name as categoryName, u.name as authorName
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        WHERE n.id = @id
      `)

    if (!result.recordset[0]) {
      return res.status(404).json({ message: "News not found" })
    }

    res.json(result.recordset[0])
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Create news
router.post("/", auth, checkRole(["admin", "editor"]), upload.single("image"), async (req, res) => {
  try {
    const { title, summary, content, categoryId, status } = req.body
    const authorId = req.user.id
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null

    const pool = await sql.connect()
    const result = await pool
      .request()
      .input("title", sql.VarChar, title)
      .input("summary", sql.VarChar, summary)
      .input("content", sql.Text, content)
      .input("categoryId", sql.Int, categoryId)
      .input("authorId", sql.Int, authorId)
      .input("status", sql.VarChar, status)
      .input("imageUrl", sql.VarChar, imageUrl)
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO News (title, summary, content, categoryId, authorId, status, imageUrl, createdAt)
        VALUES (@title, @summary, @content, @categoryId, @authorId, @status, @imageUrl, @createdAt);
        SELECT SCOPE_IDENTITY() AS id;
      `)

    const newsId = result.recordset[0].id

    res.status(201).json({
      message: "News created successfully",
      id: newsId,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Update news
router.put("/:id", auth, checkRole(["admin", "editor"]), upload.single("image"), async (req, res) => {
  try {
    const { title, summary, content, categoryId, status } = req.body
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null

    const pool = await sql.connect()

    // Check if news exists and user has permission
    const checkResult = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("userId", sql.Int, req.user.id)
      .query(`
        SELECT authorId 
        FROM News 
        WHERE id = @id
      `)

    if (!checkResult.recordset[0]) {
      return res.status(404).json({ message: "News not found" })
    }

    // Only allow admin or original author to update
    if (req.user.role !== "admin" && checkResult.recordset[0].authorId !== req.user.id) {
      return res.status(403).json({ message: "Permission denied" })
    }

    let query = `
      UPDATE News
      SET title = @title,
          summary = @summary,
          content = @content,
          categoryId = @categoryId,
          status = @status,
          updatedAt = @updatedAt
    `

    if (imageUrl) {
      query += ", imageUrl = @imageUrl"
    }

    query += " WHERE id = @id"

    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("title", sql.VarChar, title)
      .input("summary", sql.VarChar, summary)
      .input("content", sql.Text, content)
      .input("categoryId", sql.Int, categoryId)
      .input("status", sql.VarChar, status)
      .input("updatedAt", sql.DateTime, new Date())
      .input("imageUrl", sql.VarChar, imageUrl)
      .query(query)

    res.json({ message: "News updated successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Delete news
router.delete("/:id", auth, checkRole(["admin"]), async (req, res) => {
  try {
    const pool = await sql.connect()
    const result = await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM News WHERE id = @id")

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "News not found" })
    }

    res.json({ message: "News deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router