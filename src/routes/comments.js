const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const {auth} = require('../middleware/auth');
const sql = require('mssql');

/**
 * @route   GET /api/comments
 * @desc    Tüm yorumları getir (admin için)
 * @access  Private (Admin)
 */
router.get('/', auth, async (req, res) => {
  try {
    // Sadece admin kullanıcılar tüm yorumları görebilir
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const poolConnection = await pool;
    const result = await poolConnection.request()
      .query(`
        SELECT c.*, n.title as newsTitle, u.fullName as userName
        FROM Comments c
        LEFT JOIN News n ON c.newsId = n.id
        LEFT JOIN Users u ON c.userId = u.id
        ORDER BY c.createdAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Yorumları getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * @route   GET /api/comments/news/:newsId
 * @desc    Belirli bir habere ait yorumları getir
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
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * @route   GET /api/comments/pending
 * @desc    Onay bekleyen yorumları getir
 * @access  Private (Admin, Editor)
 */
router.get('/pending', auth, async (req, res) => {
  try {
    // Sadece admin ve editör kullanıcılar onay bekleyen yorumları görebilir
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const poolConnection = await pool;
    const result = await poolConnection.request()
      .query(`
        SELECT c.*, n.title as newsTitle, u.fullName as userName
        FROM Comments c
        LEFT JOIN News n ON c.newsId = n.id
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.status = 'pending'
        ORDER BY c.createdAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Onay bekleyen yorumları getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * @route   POST /api/comments
 * @desc    Yeni yorum ekle
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { newsId, content, parentId } = req.body;
    
    if (!newsId || !content) {
      return res.status(400).json({ message: 'Haber ID ve yorum içeriği gereklidir.' });
    }

    // Yorumun otomatik onaylanıp onaylanmayacağını kontrol et
    const poolConnection = await pool;
    
    // Site ayarlarından otomatik onay ayarını kontrol et
    const settingsResult = await poolConnection.request()
      .query(`SELECT value FROM Settings WHERE key = 'auto_approve_comments'`);
    
    const autoApprove = settingsResult.recordset.length > 0 && 
                        settingsResult.recordset[0].value === 'true';
    
    // Yorumu ekle
    const result = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .input('userId', sql.Int, req.user.id)
      .input('content', sql.NVarChar, content)
      .input('parentId', sql.Int, parentId || null)
      .input('status', sql.VarChar, autoApprove ? 'approved' : 'pending')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Comments (newsId, userId, content, parentId, status, createdAt)
        VALUES (@newsId, @userId, @content, @parentId, @status, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const commentId = result.recordset[0].id;
    
    // Eklenen yorumu getir
    const commentResult = await poolConnection.request()
      .input('id', sql.Int, commentId)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.id = @id
      `);

    res.status(201).json({
      comment: commentResult.recordset[0],
      message: autoApprove ? 'Yorumunuz başarıyla eklendi.' : 'Yorumunuz onay için gönderildi.'
    });
  } catch (err) {
    console.error('Yorum ekleme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * @route   PUT /api/comments/:id/approve
 * @desc    Yorumu onayla
 * @access  Private (Admin, Editor)
 */
router.put('/:id/approve', auth, async (req, res) => {
  try {
    // Sadece admin ve editör kullanıcılar yorumları onaylayabilir
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const { id } = req.params;
    
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE Comments
        SET status = 'approved'
        WHERE id = @id;
        
        SELECT c.*, n.title as newsTitle, u.fullName as userName
        FROM Comments c
        LEFT JOIN News n ON c.newsId = n.id
        LEFT JOIN Users u ON c.userId = u.id
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
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * @route   PUT /api/comments/:id/reject
 * @desc    Yorumu reddet
 * @access  Private (Admin, Editor)
 */
router.put('/:id/reject', auth, async (req, res) => {
  try {
    // Sadece admin ve editör kullanıcılar yorumları reddedebilir
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır.' });
    }

    const { id } = req.params;
    
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE Comments
        SET status = 'rejected'
        WHERE id = @id;
        
        SELECT c.*, n.title as newsTitle, u.fullName as userName
        FROM Comments c
        LEFT JOIN News n ON c.newsId = n.id
        LEFT JOIN Users u ON c.userId = u.id
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
    res.status(500).json({ message: 'Sunucu hatası' });
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
    
    // Kullanıcı yetkisini kontrol et
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
    res.status(500).json({ message: 'Sunucu hatası' });
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
    res.status(500).json({ message: 'Sunucu hatası' });
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
        SELECT c.*, u.fullName as userName, u.profileImage
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı.' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Yorum getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

/**
 * @route   GET /api/comments/count/news/:newsId
 * @desc    Belirli bir haberin yorum sayısını getir
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
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;