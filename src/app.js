const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const {logger} = require("./middleware/logEvents")
const corsOptions = require("./config/corsConfig")

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const newsRoutes = require('./routes/newsRoutes');
const commentRoutes = require('./routes/commentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const tagRoutes = require('./routes/tagRoutes');
const settingRoutes = require('./routes/settingRoutes');

const app = express();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(logger)

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/comments', commentRoutes);
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/notifications", notificationRoutes)
app.use('/api/tags', tagRoutes);
app.use('/api/settings', settingRoutes);

// Base route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API çalışıyor' });
});

// Error handler
app.use(errorHandler);

module.exports = app;