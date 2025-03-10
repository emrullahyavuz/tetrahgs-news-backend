const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { pool } = require('../config/database');
const {auth} = require('../middleware/auth');

/**
 * @route   GET /api/comments
 * @desc    Tüm yorumları getir (admin için)
 * @access  Private (Admin/Editor)
 */
router.get('/', auth, async (req, res) => {
  try {
    // Yetki kontrolü
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const poolConnection = await pool;
    const result = await poolConnection.request()
      .query(`
        SELECT c.*, u.fullName as userName, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        ORDER BY c.createdAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Yorumları getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   GET /api/comments/news/:newsId
 * @desc    Belirli bir habere ait onaylanmış yorumları getir
 * @access  Public
 */
router.get('/news/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.newsId = @newsId AND c.status = 'approved'
        ORDER BY c.createdAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Haber yorumlarını getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   GET /api/comments/pending
 * @desc    Onay bekleyen yorumları getir
 * @access  Private (Admin/Editor)
 */
router.get('/pending', auth, async (req, res) => {
  try {
    // Yetki kontrolü
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const poolConnection = await pool;
    const result = await poolConnection.request()
      .query(`
        SELECT c.*, u.fullName as userName, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.status = 'pending'
        ORDER BY c.createdAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Onay bekleyen yorumları getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   GET /api/comments/user
 * @desc    Kullanıcının kendi yorumlarını getir
 * @access  Private
 */
router.get('/user', auth, async (req, res) => {
  try {
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('userId', sql.Int, req.user.id)
      .query(`
        SELECT c.*, n.title as newsTitle
        FROM Comments c
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.userId = @userId
        ORDER BY c.createdAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Kullanıcı yorumlarını getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   GET /api/comments/:id
 * @desc    Belirli bir yorumu getir
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı.' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Yorum getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   POST /api/comments
 * @desc    Yeni yorum ekle
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { content, newsId } = req.body;
    
    // Validasyon
    if (!content || !newsId) {
      return res.status(400).json({ message: 'Yorum içeriği ve haber ID gereklidir.' });
    }

    // Yorumun otomatik onaylanıp onaylanmayacağını kontrol et
    // (Varsayılan olarak pending, site ayarlarından değiştirilebilir)
    let status = 'pending';
    
    // Admin veya editör ise otomatik onayla
    if (req.user.userType === 'admin' || req.user.userType === 'editor') {
      status = 'approved';
    }

    const poolConnection = await pool;
    
    // Yorumu ekle
    const result = await poolConnection.request()
      .input('content', sql.NVarChar, content)
      .input('newsId', sql.Int, newsId)
      .input('userId', sql.Int, req.user.id)
      .input('status', sql.NVarChar, status)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Comments (content, newsId, userId, status, createdAt)
        VALUES (@content, @newsId, @userId, @status, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const commentId = result.recordset[0].id;
    
    // Eklenen yorumu getir
    const commentResult = await poolConnection.request()
      .input('id', sql.Int, commentId)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.id = @id
      `);

    res.status(201).json({
      comment: commentResult.recordset[0],
      message: status === 'approved' ? 'Yorumunuz başarıyla eklendi.' : 'Yorumunuz onay için gönderildi.'
    });
  } catch (err) {
    console.error('Yorum ekleme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   PUT /api/comments/:id
 * @desc    Yorumu güncelle
 * @access  Private (Comment Owner, Admin, Editor)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Validasyon
    if (!content) {
      return res.status(400).json({ message: 'Yorum içeriği gereklidir.' });
    }

    // Yorumu getir
    const poolConnection = await pool;
    const commentResult = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM Comments WHERE id = @id`);

    if (commentResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı.' });
    }

    const comment = commentResult.recordset[0];
    
    // Yetki kontrolü
    const isAdmin = req.user.userType === 'admin';
    const isEditor = req.user.userType === 'editor';
    const isOwner = comment.userId === req.user.id;
    
    if (!isAdmin && !isEditor && !isOwner) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    // Yorumu güncelle
    await poolConnection.request()
      .input('id', sql.Int, id)
      .input('content', sql.NVarChar, content)
      .input('updatedAt', sql.DateTime, new Date())
      .input('status', sql.NVarChar, isOwner && !isAdmin && !isEditor ? 'pending' : comment.status)
      .query(`
        UPDATE Comments
        SET content = @content, updatedAt = @updatedAt, status = @status
        WHERE id = @id
      `);

    // Güncellenmiş yorumu getir
    const updatedResult = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.id = @id
      `);

    res.json({
      comment: updatedResult.recordset[0],
      message: 'Yorum başarıyla güncellendi.'
    });
  } catch (err) {
    console.error('Yorum güncelleme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   PUT /api/comments/:id/approve
 * @desc    Yorumu onayla
 * @access  Private (Admin, Editor)
 */
router.put('/:id/approve', auth, async (req, res) => {
  try {
    // Yetki kontrolü
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Yorumu onayla
    await poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE Comments
        SET status = 'approved', updatedAt = @updatedAt
        WHERE id = @id
      `);

    // Güncellenmiş yorumu getir
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı.' });
    }

    res.json({
      comment: result.recordset[0],
      message: 'Yorum başarıyla onaylandı.'
    });
  } catch (err) {
    console.error('Yorum onaylama hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   PUT /api/comments/:id/reject
 * @desc    Yorumu reddet
 * @access  Private (Admin, Editor)
 */
router.put('/:id/reject', auth, async (req, res) => {
  try {
    // Yetki kontrolü
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Yorumu reddet
    await poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE Comments
        SET status = 'rejected', updatedAt = @updatedAt
        WHERE id = @id
      `);

    // Güncellenmiş yorumu getir
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı.' });
    }

    res.json({
      comment: result.recordset[0],
      message: 'Yorum başarıyla reddedildi.'
    });
  } catch (err) {
    console.error('Yorum reddetme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   DELETE /api/comments/:id
 * @desc    Yorumu sil
 * @access  Private (Admin, Editor, Comment Owner)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Yorumu getir
    const poolConnection = await pool;
    const commentResult = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM Comments WHERE id = @id`);

    if (commentResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı.' });
    }

    const comment = commentResult.recordset[0];
    
    // Yetki kontrolü
    const isAdmin = req.user.userType === 'admin';
    const isEditor = req.user.userType === 'editor';
    const isOwner = comment.userId === req.user.id;
    
    if (!isAdmin && !isEditor && !isOwner) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    // Yorumu sil
    await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM Comments WHERE id = @id`);

    res.json({ message: 'Yorum başarıyla silindi.' });
  } catch (err) {
    console.error('Yorum silme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

/**
 * @route   GET /api/comments/count/news/:newsId
 * @desc    Belirli bir haberin onaylanmış yorum sayısını getir
 * @access  Public
 */
router.get('/count/news/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .query(`
        SELECT COUNT(*) as commentCount
        FROM Comments
        WHERE newsId = @newsId AND status = 'approved'
      `);

    res.json({ count: result.recordset[0].commentCount });
  } catch (err) {
    console.error('Yorum sayısı getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
});

module.exports = router;