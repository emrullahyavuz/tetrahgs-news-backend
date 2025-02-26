const express = require('express');
const { getBlogs, getBlogById } = require('../controllers/blogController');
const router = express.Router();

router.get('/', getBlogs);
router.get('/:id', getBlogById);

module.exports = router;