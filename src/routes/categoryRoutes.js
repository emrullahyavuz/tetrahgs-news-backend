const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');

// @route   GET /api/categories
// @desc    Get all categories
// @access  Public
router.get('/', categoryController.getAllCategories);

// @route   GET /api/categories/:id
// @desc    Get category by ID
// @access  Public
router.get('/:id', categoryController.getCategoryById);

// @route   GET /api/categories/slug/:slug
// @desc    Get category by slug
// @access  Public
router.get('/slug/:slug', categoryController.getCategoryBySlug);

// @route   POST /api/categories
// @desc    Create category
// @access  Private (Admin, Editor)
router.post('/', categoryController.createCategory);

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private (Admin, Editor)
router.put('/:id', categoryController.updateCategory);

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private (Admin)
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;