const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require("path")
const { connectDB } = require("./config/database")
const errorHandler = require("./middleware/error")

const authRoutes = require("./routes/auth")
const newsRoutes = require("./routes/news")
const categoriesRoutes = require("./routes/categories")
const usersRoutes = require("./routes/users")
const settingsRoutes = require("./routes/settings")

const corsOptions = {
  origin: function (origin, callback) {
    // İzin verilen origins listesi
    const whiteList = [
      "http://localhost:3000",
      "http://localhost:5173",
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


dotenv.config();

// Connect to database
connectDB()

// Middlewares
app.use(cors(corsOptions))
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
// Routes
app.use("/api/auth", authRoutes)
app.use("/api/news", newsRoutes)
app.use("/api/categories", categoriesRoutes)
app.use("/api/users", usersRoutes)
app.use("/api/settings", settingsRoutes)

// Error handling
app.use(errorHandler)

app.get('/', (req, res) => {
  res.send('API is running...');
});

module.exports = app;