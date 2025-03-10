const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const auth = require('../middleware/auth');

// @route   GET /api/tags
// @desc    Get all tags
// @access  Public
router.get('/', tagController.getAllTags);

// @route   GET /api/tags/:id
// @desc    Get tag by ID
// @access  Public
router.get('/:id', tagController.getTagById);

// @route   GET /api/tags/slug/:slug
// @desc    Get tag by slug
// @access  Public
router.get('/slug/:slug', tagController.getTagBySlug);

// @route   POST /api/tags
// @desc    Create tag
// @access  Private (Admin, Editor)
router.post('/', auth, tagController.createTag);

// @route   PUT /api/tags/:id
// @desc    Update tag
// @access  Private (Admin, Editor)
router.put('/:id', auth, tagController.updateTag);

// @route   DELETE /api/tags/:id
// @desc    Delete tag
// @access  Private (Admin, Editor)
router.delete('/:id', auth, tagController.deleteTag);

// @route   GET /api/tags/news/:slug
// @desc    Get news by tag
// @access  Public
router.get('/news/:slug', tagController.getNewsByTag);

module.exports = router;