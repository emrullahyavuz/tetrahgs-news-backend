const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/news
// @desc    Get all news
// @access  Public
router.get('/', newsController.getAllNews);

// @route   GET /api/news/:id
// @desc    Get news by ID
// @access  Public
router.get('/:id', newsController.getNewsById);

// @route   GET /api/news/slug/:slug
// @desc    Get news by slug
// @access  Public
router.get('/slug/:slug', newsController.getNewsBySlug);

// @route   POST /api/news
// @desc    Create news
// @access  Private (Admin, Editor, Author)
router.post('/', auth, upload.single('featuredImage'), newsController.createNews);

// @route   PUT /api/news/:id
// @desc    Update news
// @access  Private (Admin, Editor, Author of draft)
router.put('/:id', auth, upload.single('featuredImage'), newsController.updateNews);

// @route   DELETE /api/news/:id
// @desc    Delete news
// @access  Private (Admin, Editor, Author of draft)
router.delete('/:id', auth, newsController.deleteNews);

// @route   GET /api/news/:id/related
// @desc    Get related news
// @access  Public
router.get('/:id/related', newsController.getRelatedNews);

// @route   GET /api/news/popular
// @desc    Get popular news
// @access  Public
router.get('/popular', newsController.getPopularNews);

module.exports = router;