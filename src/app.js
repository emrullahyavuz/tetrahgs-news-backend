const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors())
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

module.exports = app;