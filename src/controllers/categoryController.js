const { pool, sql } = require('../config/database');

// Get all categories
exports.getAllCategories = async (req, res, next) => {
  try {
    const poolConnection = await pool;
    
    // Get categories
    const result = await poolConnection.request()
      .query(`
        SELECT c.*, COUNT(n.id) as newsCount
        FROM Categories c
        LEFT JOIN News n ON c.id = n.categoryId
        GROUP BY c.id, c.name, c.slug, c.description, c.createdAt, c.updatedAt
        ORDER BY c.name
      `);
    
    res.json({ categories: result.recordset });
  } catch (err) {
    next(err);
  }
};

// Get category by ID
exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Get category
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT c.*, COUNT(n.id) as newsCount
        FROM Categories c
        LEFT JOIN News n ON c.id = n.categoryId
        WHERE c.id = @id
        GROUP BY c.id, c.name, c.slug, c.description, c.createdAt, c.updatedAt
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Kategori bulunamadı' });
    }
    
    res.json({ category: result.recordset[0] });
  } catch (err) {
    next(err);
  }
};

// Get category by slug
exports.getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const poolConnection = await pool;
    
    // Get category
    const result = await poolConnection.request()
      .input('slug', sql.NVarChar, slug)
      .query(`
        SELECT c.*, COUNT(n.id) as newsCount
        FROM Categories c
        LEFT JOIN News n ON c.id = n.categoryId
        WHERE c.slug = @slug
        GROUP BY c.id, c.name, c.slug, c.description, c.createdAt, c.updatedAt
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Kategori bulunamadı' });
    }
    
    res.json({ category: result.recordset[0] });
  } catch (err) {
    next(err);
  }
};

// Create category
exports.createCategory = async (req, res, next) => {
  try {
    // // Check if admin or editor
    // if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
    //   return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    // }
    
    const { name, slug, description } = req.body;
    
    // Validation
    if (!name || !slug) {
      return res.status(400).json({ message: 'Kategori adı ve slug gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Check if slug exists
    const slugCheck = await poolConnection.request()
      .input('slug', sql.NVarChar, slug)
      .query('SELECT * FROM Categories WHERE slug = @slug');
    
    if (slugCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bu slug zaten kullanılıyor' });
    }
    
    // Create category
    const result = await poolConnection.request()
      .input('name', sql.NVarChar, name)
      .input('slug', sql.NVarChar, slug)
      .input('description', sql.NVarChar, description || null)
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Categories (name, slug, description, createdAt)
        VALUES (@name, @slug, @description, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    const categoryId = result.recordset[0].id;
    
    // Get created category
    const categoryResult = await poolConnection.request()
      .input('id', sql.Int, categoryId)
      .query('SELECT * FROM Categories WHERE id = @id');
    
    res.status(201).json({
      message: 'Kategori başarıyla oluşturuldu',
      category: categoryResult.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Update category
exports.updateCategory = async (req, res, next) => {
  try {
    // // Check if admin or editor
    // if (req.user.userType !== 'admin' && req.user.userType !== 'editor') {
    //   return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    // }
    
    const { id } = req.params;
    const { name, slug, description } = req.body;
    
    // Validation
    if (!name && !slug && !description) {
      return res.status(400).json({ message: 'Güncellenecek en az bir alan gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Check if category exists
    const categoryCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Categories WHERE id = @id');
    
    if (categoryCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Kategori bulunamadı' });
    }
    
    
    // Check if slug exists and is different from the current category slug
    if (slug && slug !== categoryCheck.recordset[0].slug) {
      const slugCheck = await poolConnection.request()
        .input('slug', sql.NVarChar, slug)
        .input('id', sql.Int, categoryCheck.recordset[0].id) // ID'yi tanımlıyoruz
        .query('SELECT * FROM Categories WHERE slug = @slug AND id != @id');

      if (slugCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Bu slug zaten kullanılıyor' });
      }
    }

    
    // Build update query
    let updateQuery = 'UPDATE Categories SET ';
    const queryParams = [];
    
    if (name) {
      queryParams.push('name = @name');
    }
    
    if (slug) {
      queryParams.push('slug = @slug');
    }
    
    if (description !== undefined) {
      queryParams.push('description = @description');
    }
    
    queryParams.push('updatedAt = @updatedAt');
    
    updateQuery += queryParams.join(', ') + ' WHERE id = @id';
    
    // Update category
    const request = poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date());
    
    if (name) request.input('name', sql.NVarChar, name);
    if (slug) request.input('slug', sql.NVarChar, slug);
    if (description !== undefined) request.input('description', sql.NVarChar, description || null);
    
    await request.query(updateQuery);
    
    // Get updated category
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Categories WHERE id = @id');
    
    res.json({
      message: 'Kategori başarıyla güncellendi',
      category: result.recordset[0]
    });
  } catch (err) {
    next(err);
  }
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
  try {
    // // Check if admin
    // if (req.user.userType !== 'admin') {
    //   return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    // }
    
    const { id } = req.params;
    
    const poolConnection = await pool;
    
    // Check if category exists
    const categoryCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Categories WHERE id = @id');
    
    if (categoryCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Kategori bulunamadı' });
    }
    
    // Check if category has news
    const newsCheck = await poolConnection.request()
      .input('categoryId', sql.Int, id)
      .query('SELECT COUNT(*) as count FROM News WHERE categoryId = @categoryId');
    
    if (newsCheck.recordset[0].count > 0) {
      return res.status(400).json({ 
        message: 'Bu kategoriye ait haberler bulunmaktadır. Önce haberleri başka bir kategoriye taşıyın veya silin.' 
      });
    }
    
    // Delete category
    await poolConnection.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Categories WHERE id = @id');
    
    res.json({ message: 'Kategori başarıyla silindi' });
  } catch (err) {
    next(err);
  }
};