const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
// const auth = require('../middleware/auth');
const {authenticate} = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
// router.post('/register', authController.register);

// @route   POST /api/auth/register-admin
// @desc    Register admin
// @access  Public (should be restricted in production)
// router.post('/register-admin', authController.registerAdmin);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authController.login);

// @route   POST /api/auth/refresh-token
// @desc    Refresh token
// @access  Public
router.post('/refresh-token', authController.refreshToken);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Public
router.post('/logout', authController.logout);

// @route   POST /api/auth/logout-all
// @desc    Logout from all devices
// @access  Private
router.post('/logout-all', authController.logoutAll);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me',authenticate, authController.getCurrentUser);

module.exports = router;