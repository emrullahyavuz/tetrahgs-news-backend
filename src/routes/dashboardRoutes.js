const express = require("express")
const router = express.Router()
const dashboardController = require("../controllers/dashboardController")
const { protect, admin, editor } = require("../middleware/auth")

// @route   GET /api/dashboard/stats
// @desc    Dashboard istatistiklerini getir
// @access  Admin/Editor
router.get("/stats", protect, editor, dashboardController.getDashboardStats)

// @route   GET /api/dashboard/categories
// @desc    Popüler kategorileri getir
// @access  Admin/Editor
router.get("/categories", protect, editor, dashboardController.getPopularCategories)

// @route   GET /api/dashboard/views
// @desc    Görüntülenme analizini getir
// @access  Admin/Editor
router.get("/views", protect, editor, dashboardController.getViewsAnalytics)

module.exports = router

