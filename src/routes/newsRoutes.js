const express = require("express")
const router = express.Router()
const newsController = require("../controllers/newsController")
const { protect, editor } = require("../middleware/auth")

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
router.post("/", newsController.createNews)
// protect, editor, 

// @route   PUT /api/news/:id
// @desc    Haberi güncelle
// @access  Editor/Admin
router.put("/:id", newsController.updateNews)
// protect, editor, 

// @route   DELETE /api/news/:id
// @desc    Haberi sil
// @access  Editor/Admin
router.delete("/:id", newsController.deleteNews)
// protect, editor, 

// @route   GET /api/news/categories
// @desc    Tüm kategorileri getir
// @access  Public
router.get("/categories/all", newsController.getCategories)

// @route   PUT /api/news/:id/status
// @desc    Haber durumunu güncelle
// @access  Editor/Admin
router.put("/:id/status", protect, editor, newsController.updateNewsStatus)

module.exports = router

