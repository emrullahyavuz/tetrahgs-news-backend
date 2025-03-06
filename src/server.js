require("dotenv").config()
const express = require("express")
const cors = require("cors")
const path = require("path")
const { connectDB, getUsers } = require("./config/database")
const errorHandler = require("./middleware/error")

// Routes
const authRoutes = require("./routes/auth")
const newsRoutes = require("./routes/news")
const categoriesRoutes = require("./routes/categories")
const usersRoutes = require("./routes/users")
const settingsRoutes = require("./routes/settings")

const app = express()

// Connect to database
console.log("Initializing database connection...")
connectDB().catch((err) => {
  console.error("Failed to connect to database:", err.message)
})

// Test database connection by getting users
getUsers()
  .then((users) => {
    console.log(`Successfully retrieved ${users.length} users from database`)
  })
  .catch((err) => {
    console.error("Error retrieving users:", err.message)
  })

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// Create uploads directory if it doesn't exist
const fs = require("fs")
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads")
  console.log("Created uploads directory")
}

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/news", newsRoutes)
app.use("/api/categories", categoriesRoutes)
app.use("/api/users", usersRoutes)
app.use("/api/settings", settingsRoutes)

// Basic route for testing
app.get("/", (req, res) => {
  res.json({ message: "Auth API is running" })
})

// Get all users route (for testing)
app.get("/api/test/users", async (req, res) => {
  try {
    const users = await getUsers()
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
  }
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

