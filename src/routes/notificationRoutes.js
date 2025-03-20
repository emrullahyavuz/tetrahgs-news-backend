const express = require("express")
const router = express.Router()
const notificationController = require("../controllers/notificationController")
const { protect } = require("../middleware/auth")

// @route   GET /api/notifications
// @desc    Kullanıcının bildirimlerini getir
// @access  Private
router.get("/", protect, notificationController.getNotifications)

// @route   PUT /api/notifications/:id/read
// @desc    Bildirimi okundu olarak işaretle
// @access  Private
router.put("/:id/read", protect, notificationController.markAsRead)

// @route   PUT /api/notifications/read-all
// @desc    Tüm bildirimleri okundu olarak işaretle
// @access  Private
router.put("/read-all", protect, notificationController.markAllAsRead)

// @route   DELETE /api/notifications/:id
// @desc    Bildirimi sil
// @access  Private
router.delete("/:id", protect, notificationController.deleteNotification)

module.exports = router

