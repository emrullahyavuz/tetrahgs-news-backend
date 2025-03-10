const { pool, sql } = require('../config/database');

// Get all comments (admin/editor only)
exports.getAllComments = async (req, res, next) => {
  try {
    // Check if admin or editor
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const poolConnection = await pool;
    
    // Get comments
    const result = await poolConnection.request()
      .query(`
        SELECT c.*, u.fullName as userName, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        ORDER BY c.createdAt DESC
      `);
    
    res.json({ comments: result.recordset });
  } catch (err) {
    next(err);
  }
};

// Get comments by news ID
exports.getCommentsByNewsId = async (req, res, next) => {
  try {
    const { newsId } = req.params;
    
    const poolConnection = await pool;
    
    // Check if news exists
    const newsCheck = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .query('SELECT * FROM News WHERE id = @newsId');
    
    if (newsCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Haber bulunamadı' });
    }
    
    // Get comments
    const result = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .query(`
        SELECT c.*, u.fullName as userName, u.profileImage
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.newsId = @newsId AND c.status = 'approved'
        ORDER BY c.createdAt DESC
      `);
    
    res.json({ comments: result.recordset });
  } catch (err) {
    next(err);
  }
};

// Get pending comments (admin/editor only)
exports.getPendingComments = async (req, res, next) => {
  try {
    // Check if admin or editor
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const poolConnection = await pool;
    
    // Get pending comments
    const result = await poolConnection.request()
      .query(`
        SELECT c.*, u.fullName as userName, n.title as newsTitle
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.status = 'pending'
        ORDER BY c.createdAt DESC
      `);
    
    res.json({ comments: result.recordset });
  } catch (err) {
    next(err);
  }
};

// Get user comments
exports.getUserComments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const poolConnection = await pool;
    
    // Get user comments
    const result = await poolConnection.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT c.*, n.title as newsTitle
        FROM Comments c
        LEFT JOIN News n ON c.newsId = n.id
        WHERE c.userId = @userId
        ORDER BY c.createdAt DESC
      `);
    
    res.json({ comments: result.recordset });
  } catch (err) {
    next(err);
  }
};

// Create comment
exports.createComment = async (req, res, next) => {
  try {
    const { content, newsId } = req.body;
    const userId = req.user.id;
    
    // Validation
    if (!content) {
      return res.status(400).json({ message: 'Yorum içeriği gereklidir' });
    }
    
    if (!newsId) {
      return res.status(400).json({ message: 'Haber ID gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Check if news exists
    const newsCheck = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .query('SELECT * FROM News WHERE id = @newsId');
    
    if (newsCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Haber bulunamadı' });
    }
    
    // Check if comments are allowed
    const settingsResult = await poolConnection.request()
      .query("SELECT value FROM Settings WHERE [key] = 'allow_comments'");
    
    const allowComments = settingsResult.recordset.length > 0 && settingsResult.recordset[0].value === 'true';
    
    if (!allowComments) {
      return res.status(403).json({ message: 'Yorumlar şu anda kapalıdır' });
    }
    
    // Check if auto-approve is enabled
    const autoApproveResult = await poolConnection.request()
      .query("SELECT value FROM Settings WHERE [key] = 'auto_approve_comments'");
    
    const autoApprove = autoApproveResult.recordset.length > 0 && autoApproveResult.recordset[0].value === 'true';
    
    // Set status based on auto-approve setting and user type
    let status = 'pending';
    if (autoApprove || req.user.userType === 'admin' || req.user.userType === 'editor') {
      status = 'approved';
    }
    
    // Create comment
    const result = await poolConnection.request()
      .input('content', sql.NVarChar, content)
      .input('newsId', sql.Int, newsId)
      .input('userId', sql.Int, userId)
      .input('status', sql.NVarChar, status)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Comments (content, newsId, userId, status, createdAt)
        VALUES (@content, @newsId, @userId, @status, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    const commentId = result.recordset[0].id;
    
    // Get created comment
    const commentResult = await poolConnection.request()
      .input('id', sql.Int, commentId)
      .query(`
        SELECT c.*, u.fullName as userName
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.id = @id
      `);
    
    res.status(201).json({
      message: status === 'approved' ? 'Yorumunuz başarıyla eklendi' : 'Yorumunuz onay için gönderildi',
      comment: commentResult.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Update comment
exports.updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Validation
    if (!content) {
      return res.status(400).json({ message: 'Yorum içeriği gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Get comment
    const commentCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Comments WHERE id = @id');
    
    if (commentCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı' });
    }
    
    const comment = commentCheck.recordset[0];
    
    // Check permissions
    const isAdmin = req.user.userType === 'admin';
    const isEditor = req.user.userType === 'editor';
    const isOwner = req.user.id === comment.userId;
    
    if (!isAdmin && !isEditor && !isOwner) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    // Update comment
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
    
    // Get updated comment
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.fullName as userName
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.id = @id
      `);
    
    res.json({
      message: 'Yorum başarıyla güncellendi',
      comment: result.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Approve comment
exports.approveComment = async (req, res, next) => {
  try {
    // Check if admin or editor
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Get comment
    const commentCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Comments WHERE id = @id');
    
    if (commentCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı' });
    }
    
    // Update comment
    await poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE Comments
        SET status = 'approved', updatedAt = @updatedAt
        WHERE id = @id
      `);
    
    // Get updated comment
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.fullName as userName
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.id = @id
      `);
    
    res.json({
      message: 'Yorum başarıyla onaylandı',
      comment: result.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Reject comment
exports.rejectComment = async (req, res, next) => {
  try {
    // Check if admin or editor
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Get comment
    const commentCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Comments WHERE id = @id');
    
    if (commentCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı' });
    }
    
    // Update comment
    await poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE Comments
        SET status = 'rejected', updatedAt = @updatedAt
        WHERE id = @id
      `);
    
    // Get updated comment
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, u.fullName as userName
        FROM Comments c
        LEFT JOIN Users u ON c.userId = u.id
        WHERE c.id = @id
      `);
    
    res.json({
      message: 'Yorum başarıyla reddedildi',
      comment: result.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Delete comment
exports.deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Get comment
    const commentCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Comments WHERE id = @id');
    
    if (commentCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Yorum bulunamadı' });
    }
    
    const comment = commentCheck.recordset[0];
    
    // Check permissions
    const isAdmin = req.user.userType === 'admin';
    const isEditor = req.user.userType === 'editor';
    const isOwner = req.user.id === comment.userId;
    
    if (!isAdmin && !isEditor && !isOwner) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    // Delete comment
    await poolConnection.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Comments WHERE id = @id');
    
    res.json({ message: 'Yorum başarıyla silindi' });
  } catch (err) {
    next(err);
  }
};

// Get comment count by news ID
exports.getCommentCountByNewsId = async (req, res, next) => {
  try {
    const { newsId } = req.params;
    
    const poolConnection = await pool;
    
    // Get comment count
    const result = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .query(`
        SELECT COUNT(*) as count
        FROM Comments
        WHERE newsId = @newsId AND status = 'approved'
      `);
    
    res.json({ count: result.recordset[0].count });
  } catch (err) {
    next(err);
  }
};