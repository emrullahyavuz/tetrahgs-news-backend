const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const {admin} = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/', userController.getAllUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin or Self)
router.get('/:id', userController.getUserById);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin or Self)
router.put('/:id', userController.updateUser);

// @route   PUT /api/users/:id/password
// @desc    Update password
// @access  Private (Self)
router.put('/:id/password', userController.updatePassword);

// @route   POST /api/users/:id/profile-image
// @desc    Upload profile image
// @access  Private (Admin or Self)
router.post('/:id/profile-image', upload.single('profileImage'), userController.uploadProfileImage);


router.post('/', userController.createUser)

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin or Self)
router.delete('/:id', admin, userController.deleteUser);

module.exports = router;