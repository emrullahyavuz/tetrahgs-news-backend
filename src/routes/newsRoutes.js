const express = require("express")
const router = express.Router()
const newsController = require("../controllers/newsController")
const { protect, editor, admin } = require("../middleware/auth")

// @route   GET /api/news
// @desc    Tüm haberleri getir (filtreleme ve arama desteği ile)
// @access  Public
router.get("/", newsController.getNews)

// @route   GET /api/news/:id
// @desc    Belirli bir haberi getir
// @access  Public
router.get("/:id", newsController.getNewsById)

// @route   POST /api/news
// @desc    Yeni haber ekle
// @access  Editor/Admin
router.post("/", protect, editor, newsController.createNews)

// @route   PUT /api/news/:id
// @desc    Haberi güncelle
// @access  Editor/Admin
router.put("/:id", protect, editor, newsController.updateNews)

// @route   DELETE /api/news/:id
// @desc    Haberi sil
// @access  Editor/Admin
router.delete("/:id", protect, editor, newsController.deleteNews)

// @route   GET /api/news/categories/all
// @desc    Tüm kategorileri getir
// @access  Public
router.get("/categories/all", newsController.getCategories)

// @route   PUT /api/news/:id/status
// @desc    Haber durumunu güncelle
// @access  Editor/Admin
router.put("/:id/status", protect, editor, newsController.updateNewsStatus)

module.exports = router

