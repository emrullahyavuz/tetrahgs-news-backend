const { pool, sql } = require('../config/database');
const { deleteFile, getFileUrl } = require('../utils/fileUtils');

// Get all news
exports.getAllNews = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      tag, 
      search, 
      status,
      authorId
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const poolConnection = await pool;
    
    // Build query
    let query = `
      SELECT n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName,
             COUNT(DISTINCT com.id) as commentCount
      FROM News n
      LEFT JOIN Categories c ON n.categoryId = c.id
      LEFT JOIN Users u ON n.authorId = u.id
      LEFT JOIN Comments com ON n.id = com.newsId AND com.status = 'approved'
    `;
    
    // Build where clause
    const whereConditions = [];
    const queryParams = {};
    
    // Filter by status (admin/editor only)
    if (req.user && (req.user.userType === 'admin' || req.user.userType === 'editor')) {
      if (status) {
        whereConditions.push('n.status = @status');
        queryParams.status = status;
      }
    } else {
      // Public can only see published news
      whereConditions.push("n.status = 'published'");
    }
    
    // Filter by category
    if (category) {
      whereConditions.push('c.slug = @category');
      queryParams.category = category;
    }
    
    // Filter by tag
    if (tag) {
      query += `
        LEFT JOIN NewsTags nt ON n.id = nt.newsId
        LEFT JOIN Tags t ON nt.tagId = t.id
      `;
      whereConditions.push('t.slug = @tag');
      queryParams.tag = tag;
    }
    
    // Filter by search
    if (search) {
      whereConditions.push('(n.title LIKE @search OR n.content LIKE @search)');
      queryParams.search = `%${search}%`;
    }
    
    // Filter by author
    if (authorId) {
      whereConditions.push('n.authorId = @authorId');
      queryParams.authorId = authorId;
    }
    
    // Add where clause
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Add group by
    query += `
      GROUP BY n.id, n.title, n.slug, n.content, n.summary, n.featuredImage, n.status, 
               n.viewCount, n.categoryId, n.authorId, n.publishedAt, n.createdAt, n.updatedAt,
               c.name, c.slug, u.fullName
    `;
    
    // Add order by
    query += ' ORDER BY n.publishedAt DESC, n.createdAt DESC';
    
    // Add pagination
    query += ' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
    queryParams.offset = offset;
    queryParams.limit = parseInt(limit);
    
    // Execute query
    const request = poolConnection.request();
    
    // Add parameters
    for (const [key, value] of Object.entries(queryParams)) {
      request.input(key, value);
    }
    
    const result = await request.query(query);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT n.id) as total
      FROM News n
      LEFT JOIN Categories c ON n.categoryId = c.id
    `;
    
    // Add tag join if needed
    if (tag) {
      countQuery += `
        LEFT JOIN NewsTags nt ON n.id = nt.newsId
        LEFT JOIN Tags t ON nt.tagId = t.id
      `;
    }
    
    // Add where clause
    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    const countRequest = poolConnection.request();
    
    // Add parameters
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'offset' && key !== 'limit') {
        countRequest.input(key, value);
      }
    }
    
    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;
    
    // Add featured image URL
    const news = result.recordset.map(item => ({
      ...item,
      featuredImage: getFileUrl(req, item.featuredImage)
    }));
    
    res.json({
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

// Get news by ID
exports.getNewsById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Get news
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName,
               COUNT(DISTINCT com.id) as commentCount
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        LEFT JOIN Comments com ON n.id = com.newsId AND com.status = 'approved'
        WHERE n.id = @id
        GROUP BY n.id, n.title, n.slug, n.content, n.summary, n.featuredImage, n.status, 
                 n.viewCount, n.categoryId, n.authorId, n.publishedAt, n.createdAt, n.updatedAt,
                 c.name, c.slug, u.fullName
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Haber bulunamadı' });
    }
    
    const news = result.recordset[0];
    
    // Check if user can view unpublished news
    if (news.status !== 'published' && 
        (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'editor' && req.user.id !== news.authorId))) {
      return res.status(403).json({ message: 'Bu haberi görüntüleme yetkiniz bulunmamaktadır' });
    }
    
    // Get tags
    const tagsResult = await poolConnection.request()
      .input('newsId', sql.Int, id)
      .query(`
        SELECT t.*
        FROM Tags t
        JOIN NewsTags nt ON t.id = nt.tagId
        WHERE nt.newsId = @newsId
      `);
    
    news.tags = tagsResult.recordset;
    
    // Add featured image URL
    news.featuredImage = getFileUrl(req, news.featuredImage);
    
    // Increment view count
    if (news.status === 'published') {
      await poolConnection.request()
        .input('id', sql.Int, id)
        .query('UPDATE News SET viewCount = viewCount + 1 WHERE id = @id');
    }
    
    res.json({ news });
  } catch (err) {
    next(err);
  }
};

// Get news by slug
exports.getNewsBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const poolConnection = await pool;
    
    // Get news
    const result = await poolConnection.request()
      .input('slug', sql.NVarChar, slug)
      .query(`
        SELECT n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName,
               COUNT(DISTINCT com.id) as commentCount
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        LEFT JOIN Comments com ON n.id = com.newsId AND com.status = 'approved'
        WHERE n.slug = @slug
        GROUP BY n.id, n.title, n.slug, n.content, n.summary, n.featuredImage, n.status, 
                 n.viewCount, n.categoryId, n.authorId, n.publishedAt, n.createdAt, n.updatedAt,
                 c.name, c.slug, u.fullName
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Haber bulunamadı' });
    }
    
    const news = result.recordset[0];
    
    // Check if user can view unpublished news
    if (news.status !== 'published' && 
        (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'editor' && req.user.id !== news.authorId))) {
      return res.status(403).json({ message: 'Bu haberi görüntüleme yetkiniz bulunmamaktadır' });
    }
    
    // Get tags
    const tagsResult = await poolConnection.request()
      .input('newsId', sql.Int, news.id)
      .query(`
        SELECT t.*
        FROM Tags t
        JOIN NewsTags nt ON t.id = nt.tagId
        WHERE nt.newsId = @newsId
      `);
    
    news.tags = tagsResult.recordset;
    
    // Add featured image URL
    news.featuredImage = getFileUrl(req, news.featuredImage);
    
    // Increment view count
    if (news.status === 'published') {
      await poolConnection.request()
        .input('id', sql.Int, news.id)
        .query('UPDATE News SET viewCount = viewCount + 1 WHERE id = @id');
    }
    
    res.json({ news });
  } catch (err) {
    next(err);
  }
};

// Create news
exports.createNews = async (req, res, next) => {
  try {
    // Check if admin, editor or author
    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'editor' && req.user.userType !== 'author')) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { 
      title, 
      slug, 
      content, 
      summary, 
      categoryId, 
      status = 'draft',
      tags = []
    } = req.body;
    
    // Validation
    if (!title || !slug || !content || !categoryId) {
      return res.status(400).json({ message: 'Başlık, slug, içerik ve kategori gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Check if slug exists
    const slugCheck = await poolConnection.request()
      .input('slug', sql.NVarChar, slug)
      .query('SELECT * FROM News WHERE slug = @slug');
    
    if (slugCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bu slug zaten kullanılıyor' });
    }
    
    // Check if category exists
    const categoryCheck = await poolConnection.request()
      .input('categoryId', sql.Int, categoryId)
      .query('SELECT * FROM Categories WHERE id = @categoryId');
    
    if (categoryCheck.recordset.length === 0) {
      return res.status(400).json({ message: 'Kategori bulunamadı' });
    }
    
    // Set published date if status is published
    const publishedAt = status === 'published' ? new Date() : null;
    
    // Create news
    const result = await poolConnection.request()
      .input('title', sql.NVarChar, title)
      .input('slug', sql.NVarChar, slug)
      .input('content', sql.NVarChar, content)
      .input('summary', sql.NVarChar, summary || null)
      .input('featuredImage', sql.NVarChar, req.file ? req.file.filename : null)
      .input('status', sql.NVarChar, status)
      .input('categoryId', sql.Int, categoryId)
      .input('authorId', sql.Int, req.user.id)
      .input('publishedAt', sql.DateTime, publishedAt)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO News (title, slug, content, summary, featuredImage, status, categoryId, authorId, publishedAt, createdAt)
        VALUES (@title, @slug, @content, @summary, @featuredImage, @status, @categoryId, @authorId, @publishedAt, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    const newsId = result.recordset[0].id;
    
    // Add tags
    if (tags.length > 0) {
      for (const tagId of tags) {
        // Check if tag exists
        const tagCheck = await poolConnection.request()
          .input('tagId', sql.Int, tagId)
          .query('SELECT * FROM Tags WHERE id = @tagId');
        
        if (tagCheck.recordset.length > 0) {
          // Add tag to news
          await poolConnection.request()
            .input('newsId', sql.Int, newsId)
            .input('tagId', sql.Int, tagId)
            .query('INSERT INTO NewsTags (newsId, tagId) VALUES (@newsId, @tagId)');
        }
      }
    }
    
    // Get created news
    const newsResult = await poolConnection.request()
      .input('id', sql.Int, newsId)
      .query(`
        SELECT n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        WHERE n.id = @id
      `);
    
    // Get tags
    const tagsResult = await poolConnection.request()
      .input('newsId', sql.Int, newsId)
      .query(`
        SELECT t.*
        FROM Tags t
        JOIN NewsTags nt ON t.id = nt.tagId
        WHERE nt.newsId = @newsId
      `);
    
    const news = newsResult.recordset[0];
    news.tags = tagsResult.recordset;
    
    // Add featured image URL
    news.featuredImage = getFileUrl(req, news.featuredImage);
    
    res.status(201).json({
      message: 'Haber başarıyla oluşturuldu',
      news
    });
  } catch (err) {
    next(err);
  }
};

// Update news
exports.updateNews = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      slug, 
      content, 
      summary, 
      categoryId, 
      status,
      tags = []
    } = req.body;
    
    const poolConnection = await pool;
    
    // Get news
    const newsCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM News WHERE id = @id');
    
    if (newsCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Haber bulunamadı' });
    }
    
    const news = newsCheck.recordset[0];
    
    // Check permissions
    const isAdmin = req.user.userType === 'admin';
    const isEditor = req.user.userType === 'editor';
    const isAuthor = req.user.id === news.authorId;
    
    if (!isAdmin && !isEditor && !isAuthor) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    // Authors can only edit their own drafts
    if (isAuthor && !isAdmin && !isEditor && news.status !== 'draft') {
      return res.status(403).json({ message: 'Sadece taslak haberlerinizi düzenleyebilirsiniz' });
    }
    
    // Check if slug exists
    if (slug && slug !== news.slug) {
      const slugCheck = await poolConnection.request()
        .input('slug', sql.NVarChar, slug)
        .input('id', sql.Int, id)
        .query('SELECT * FROM News WHERE slug = @slug AND id != @id');
      
      if (slugCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Bu slug zaten kullanılıyor' });
      }
    }
    
    // Check if category exists
    if (categoryId) {
      const categoryCheck = await poolConnection.request()
        .input('categoryId', sql.Int, categoryId)
        .query('SELECT * FROM Categories WHERE id = @categoryId');
      
      if (categoryCheck.recordset.length === 0) {
        return res.status(400).json({ message: 'Kategori bulunamadı' });
      }
    }
    
    // Set published date if status is changing to published
    let publishedAt = news.publishedAt;
    if (status === 'published' && news.status !== 'published') {
      publishedAt = new Date();
    }
    
    // Build update query
    let updateQuery = 'UPDATE News SET ';
    const queryParams = [];
    
    if (title) {
      queryParams.push('title = @title');
    }
    
    if (slug) {
      queryParams.push('slug = @slug');
    }
    
    if (content) {
      queryParams.push('content = @content');
    }
    
    if (summary !== undefined) {
      queryParams.push('summary = @summary');
    }
    
    if (req.file) {
      queryParams.push('featuredImage = @featuredImage');
    }
    
    if (status) {
      queryParams.push('status = @status');
    }
    
    if (categoryId) {
      queryParams.push('categoryId = @categoryId');
    }
    
    if (publishedAt !== news.publishedAt) {
      queryParams.push('publishedAt = @publishedAt');
    }
    
    queryParams.push('updatedAt = @updatedAt');
    
    updateQuery += queryParams.join(', ') + ' WHERE id = @id';
    
    // Update news
    const request = poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date());
    
    if (title) request.input('title', sql.NVarChar, title);
    if (slug) request.input('slug', sql.NVarChar, slug);
    if (content) request.input('content', sql.NVarChar, content);
    if (summary !== undefined) request.input('summary', sql.NVarChar, summary || null);
    if (req.file) {
      // Delete old featured image
      if (news.featuredImage) {
        deleteFile(news.featuredImage);
      }
      request.input('featuredImage', sql.NVarChar, req.file.filename);
    }
    if (status) request.input('status', sql.NVarChar, status);
    if (categoryId) request.input('categoryId', sql.Int, categoryId);
    if (publishedAt !== news.publishedAt) request.input('publishedAt', sql.DateTime, publishedAt);
    
    await request.query(updateQuery);
    
    // Update tags
    if (tags.length > 0) {
      // Delete existing tags
      await poolConnection.request()
        .input('newsId', sql.Int, id)
        .query('DELETE FROM NewsTags WHERE newsId = @newsId');
      
      // Add new tags
      for (const tagId of tags) {
        // Check if tag exists
        const tagCheck = await poolConnection.request()
          .input('tagId', sql.Int, tagId)
          .query('SELECT * FROM Tags WHERE id = @tagId');
        
        if (tagCheck.recordset.length > 0) {
          // Add tag to news
          await poolConnection.request()
            .input('newsId', sql.Int, id)
            .input('tagId', sql.Int, tagId)
            .query('INSERT INTO NewsTags (newsId, tagId) VALUES (@newsId, @tagId)');
        }
      }
    }
    
    // Get updated news
    const newsResult = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        WHERE n.id = @id
      `);
    
    // Get tags
    const tagsResult = await poolConnection.request()
      .input('newsId', sql.Int, id)
      .query(`
        SELECT t.*
        FROM Tags t
        JOIN NewsTags nt ON t.id = nt.tagId
        WHERE nt.newsId = @newsId
      `);
    
    const updatedNews = newsResult.recordset[0];
    updatedNews.tags = tagsResult.recordset;
    
    // Add featured image URL
    updatedNews.featuredImage = getFileUrl(req, updatedNews.featuredImage);
    
    res.json({
      message: 'Haber başarıyla güncellendi',
      news: updatedNews
    });
  } catch (err) {
    next(err);
  }
};

// Delete news
exports.deleteNews = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Get news
    const newsCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM News WHERE id = @id');
    
    if (newsCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Haber bulunamadı' });
    }
    
    const news = newsCheck.recordset[0];
    
    // Check permissions
    const isAdmin = req.user.userType === 'admin';
    const isEditor = req.user.userType === 'editor';
    const isAuthor = req.user.id === news.authorId;
    
    if (!isAdmin && !isEditor && !isAuthor) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    // Authors can only delete their own drafts
    if (isAuthor && !isAdmin && !isEditor && news.status !== 'draft') {
      return res.status(403).json({ message: 'Sadece taslak haberlerinizi silebilirsiniz' });
    }
    
    // Delete featured image
    if (news.featuredImage) {
      deleteFile(news.featuredImage);
    }
    
    // Delete news
    await poolConnection.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM News WHERE id = @id');
    
    res.json({ message: 'Haber başarıyla silindi' });
  } catch (err) {
    next(err);
  }
};

// Get related news
exports.getRelatedNews = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;
    
    const poolConnection = await pool;
    
    // Get news
    const newsCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT categoryId FROM News WHERE id = @id');
    
    if (newsCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Haber bulunamadı' });
    }
    
    const categoryId = newsCheck.recordset[0].categoryId;
    
    // Get related news
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .input('categoryId', sql.Int, categoryId)
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT TOP (@limit) n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        WHERE n.id != @id AND n.categoryId = @categoryId AND n.status = 'published'
        ORDER BY n.publishedAt DESC, n.createdAt DESC
      `);
    
    // Add featured image URL
    const relatedNews = result.recordset.map(item => ({
      ...item,
      featuredImage: getFileUrl(req, item.featuredImage)
    }));
    
    res.json({ relatedNews });
  } catch (err) {
    next(err);
  }
};

// Get popular news
exports.getPopularNews = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;
    
    const poolConnection = await pool;
    
    // Get popular news
    const result = await poolConnection.request()
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT TOP (@limit) n.*, c.name as categoryName, c.slug as categorySlug, u.fullName as authorName
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        WHERE n.status = 'published'
        ORDER BY n.viewCount DESC, n.publishedAt DESC
      `);
    
    // Add featured image URL
    const popularNews = result.recordset.map(item => ({
      ...item,
      featuredImage: getFileUrl(req, item.featuredImage)
    }));
    
    res.json({ popularNews });
  } catch (err) {
    next(err);
  }
};