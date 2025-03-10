const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/', auth, userController.getAllUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin or Self)
router.get('/:id', auth, userController.getUserById);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin or Self)
router.put('/:id', auth, userController.updateUser);

// @route   PUT /api/users/:id/password
// @desc    Update password
// @access  Private (Self)
router.put('/:id/password', auth, userController.updatePassword);

// @route   POST /api/users/:id/profile-image
// @desc    Upload profile image
// @access  Private (Admin or Self)
router.post('/:id/profile-image', auth, upload.single('profileImage'), userController.uploadProfileImage);

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin or Self)
router.delete('/:id', auth, userController.deleteUser);

module.exports = router;