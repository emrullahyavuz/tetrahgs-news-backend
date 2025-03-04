const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');
const dotenv = require('dotenv');


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

app.use(cors(corsOptions))
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

module.exports = app;