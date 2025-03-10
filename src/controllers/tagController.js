const { pool, sql } = require('../config/database');

// Get all tags
exports.getAllTags = async (req, res, next) => {
  try {
    const poolConnection = await pool;
    
    // Get tags
    const result = await poolConnection.request()
      .query(`
        SELECT t.*, COUNT(nt.newsId) as newsCount
        FROM Tags t
        LEFT JOIN NewsTags nt ON t.id = nt.tagId
        GROUP BY t.id, t.name, t.slug, t.createdAt, t.updatedAt
        ORDER BY t.name
      `);
    
    res.json({ tags: result.recordset });
  } catch (err) {
    next(err);
  }
};

// Get tag by ID
exports.getTagById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Get tag
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT t.*, COUNT(nt.newsId) as newsCount
        FROM Tags t
        LEFT JOIN NewsTags nt ON t.id = nt.tagId
        WHERE t.id = @id
        GROUP BY t.id, t.name, t.slug, t.createdAt, t.updatedAt
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Etiket bulunamadı' });
    }
    
    res.json({ tag: result.recordset[0] });
  } catch (err) {
    next(err);
  }
};

// Get tag by slug
exports.getTagBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const poolConnection = await pool;
    
    // Get tag
    const result = await poolConnection.request()
      .input('slug', sql.NVarChar, slug)
      .query(`
        SELECT t.*, COUNT(nt.newsId) as newsCount
        FROM Tags t
        LEFT JOIN NewsTags nt ON t.id = nt.tagId
        WHERE t.slug = @slug
        GROUP BY t.id, t.name, t.slug, t.createdAt, t.updatedAt
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Etiket bulunamadı' });
    }
    
    res.json({ tag: result.recordset[0] });
  } catch (err) {
    next(err);
  }
};

// Create tag
exports.createTag = async (req, res, next) => {
  try {
    // Check if admin or editor
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { name, slug } = req.body;
    
    // Validation
    if (!name || !slug) {
      return res.status(400).json({ message: 'Etiket adı ve slug gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Check if slug exists
    const slugCheck = await poolConnection.request()
      .input('slug', sql.NVarChar, slug)
      .query('SELECT * FROM Tags WHERE slug = @slug');
    
    if (slugCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bu slug zaten kullanılıyor' });
    }
    
    // Create tag
    const result = await poolConnection.request()
      .input('name', sql.NVarChar, name)
      .input('slug', sql.NVarChar, slug)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Tags (name, slug, createdAt)
        VALUES (@name, @slug, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    const tagId = result.recordset[0].id;
    
    // Get created tag
    const tagResult = await poolConnection.request()
      .input('id', sql.Int, tagId)
      .query('SELECT * FROM Tags WHERE id = @id');
    
    res.status(201).json({
      message: 'Etiket başarıyla oluşturuldu',
      tag: tagResult.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Update tag
exports.updateTag = async (req, res, next) => {
  try {
    // Check if admin or editor
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { id } = req.params;
    const { name, slug } = req.body;
    
    // Validation
    if (!name && !slug) {
      return res.status(400).json({ message: 'Güncellenecek en az bir alan gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Check if tag exists
    const tagCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Tags WHERE id = @id');
    
    if (tagCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Etiket bulunamadı' });
    }
    
    // Check if slug exists
    if (slug && slug !== tagCheck.recordset[0].slug) {
      const slugCheck = await poolConnection.request()
        .input('slug', sql.NVarChar, slug)
        .query('SELECT * FROM Tags WHERE slug = @slug AND id != @id');
      
      if (slugCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Bu slug zaten kullanılıyor' });
      }
    }
    
    // Build update query
    let updateQuery = 'UPDATE Tags SET ';
    const queryParams = [];
    
    if (name) {
      queryParams.push('name = @name');
    }
    
    if (slug) {
      queryParams.push('slug = @slug');
    }
    
    queryParams.push('updatedAt = @updatedAt');
    
    updateQuery += queryParams.join(', ') + ' WHERE id = @id';
    
    // Update tag
    const request = poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date());
    
    if (name) request.input('name', sql.NVarChar, name);
    if (slug) request.input('slug', sql.NVarChar, slug);
    
    await request.query(updateQuery);
    
    // Get updated tag
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Tags WHERE id = @id');
    
    res.json({
      message: 'Etiket başarıyla güncellendi',
      tag: result.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Delete tag
exports.deleteTag = async (req, res, next) => {
  try {
    // Check if admin or editor
    if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Check if tag exists
    const tagCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Tags WHERE id = @id');
    
    if (tagCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Etiket bulunamadı' });
    }
    
    // Delete tag
    await poolConnection.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Tags WHERE id = @id');
    
    res.json({ message: 'Etiket başarıyla silindi' });
  } catch (err) {
    next(err);
  }
};

// Get news by tag
exports.getNewsByTag = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    
    const poolConnection = await pool;
    
    // Check if tag exists
    const tagCheck = await poolConnection.request()
      .input('slug', sql.NVarChar, slug)
      .query('SELECT * FROM Tags WHERE slug = @slug');
    
    if (tagCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Etiket bulunamadı' });
    }
    
    const tag = tagCheck.recordset[0];
    
    // Get news by tag
    const result = await poolConnection.request()
      .input('tagId', sql.Int, tag.id)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName
        FROM News n
        JOIN NewsTags nt ON n.id = nt.newsId
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        WHERE nt.tagId = @tagId AND n.status = 'published'
        ORDER BY n.publishedAt DESC, n.createdAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);
    
    // Get total count
    const countResult = await poolConnection.request()
      .input('tagId', sql.Int, tag.id)
      .query(`
        SELECT COUNT(*) as total
        FROM News n
        JOIN NewsTags nt ON n.id = nt.newsId
        WHERE nt.tagId = @tagId AND n.status = 'published'
      `);
    
    const total = countResult.recordset[0].total;
    
    // Add featured image URL
    const news = result.recordset.map(item => ({
      ...item,
      featuredImage: getFileUrl(req, item.featuredImage)
    }));
    
    res.json({
      tag,
      news,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};