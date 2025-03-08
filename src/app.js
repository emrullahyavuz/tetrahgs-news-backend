require("dotenv").config()
const express = require("express")
const app = express()
const cors = require("cors")
const path = require("path")
const cookieParser = require("cookie-parser");
const { connectDB, getUsers } = require("./config/database")
const {logger} = require("./middleware/logEvents")
// const errorHandler = require("./middleware/error")

// Routes
const authRoutes = require("./routes/auth")
const newsRoutes = require("./routes/news")
const categoriesRoutes = require("./routes/categories")
const usersRoutes = require("./routes/users")
const commentsRoutes = require("./routes/comments")
const settingsRoutes = require("./routes/settings")


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

  // Tüm originlere izin veren basit yapılandırma
const corsOptions = {
  origin: function (origin, callback) {
    // İzin verilen origins listesi
    const whiteList = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5000",
      "http://127.0.0.1:5173",
      "https://www.google.com",
    ];

    if (whiteList.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("CORS politikası tarafından engellendiniz."));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400, // 24 saat
};

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser());
app.use(logger);
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
app.use("/api/comments", commentsRoutes);
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

module.exports = app;