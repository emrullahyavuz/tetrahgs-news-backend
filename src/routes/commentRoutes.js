const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const auth = require('../middleware/auth');

// @route   GET /api/comments
// @desc    Get all comments
// @access  Private (Admin, Editor)
router.get('/', auth, commentController.getAllComments);

// @route   GET /api/comments/news/:newsId
// @desc    Get comments by news ID
// @access  Public
router.get('/news/:newsId', commentController.getCommentsByNewsId);

// @route   GET /api/comments/pending
// @desc    Get pending comments
// @access  Private (Admin, Editor)
router.get('/pending', auth, commentController.getPendingComments);

// @route   GET /api/comments/user
// @desc    Get user comments
// @access  Private
router.get('/user', auth, commentController.getUserComments);

// @route   POST /api/comments
// @desc    Create comment
// @access  Private
router.post('/', auth, commentController.createComment);

// @route   PUT /api/comments/:id
// @desc    Update comment
// @access  Private (Admin, Editor, Comment Owner)
router.put('/:id', auth, commentController.updateComment);

// @route   PUT /api/comments/:id/approve
// @desc    Approve comment
// @access  Private (Admin, Editor)
router.put('/:id/approve', auth, commentController.approveComment);

// @route   PUT /api/comments/:id/reject
// @desc    Reject comment
// @access  Private (Admin, Editor)
router.put('/:id/reject', auth, commentController.rejectComment);

// @route   DELETE /api/comments/:id
// @desc    Delete comment
// @access  Private (Admin, Editor, Comment Owner)
router.delete('/:id', auth, commentController.deleteComment);

// @route   GET /api/comments/count/news/:newsId
// @desc    Get comment count by news ID
// @access  Public
router.get('/count/news/:newsId', commentController.getCommentCountByNewsId);

module.exports = router;