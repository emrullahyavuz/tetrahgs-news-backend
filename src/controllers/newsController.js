const { pool, sql } = require("../config/database")
const { createSlug } = require("../utils/helpers")

// Tüm haberleri getir (filtreleme ve arama desteği ile)
exports.getNews = async (req, res, next) => {
  try {
    const { search, category, status, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query

    const poolConnection = await pool

    // Temel sorgu
    let query = `
      SELECT n.id, n.title, n.summary, n.content, n.slug, n.status, 
             n.imageUrl, n.createdAt, n.updatedAt, n.viewCount,
             c.name as category, c.id as categoryId, u.fullName as author, u.id as authorId
      FROM News n
      LEFT JOIN Categories c ON n.categoryId = c.id
      LEFT JOIN Users u ON n.authorId = u.id
      WHERE 1=1
    `

    // Parametreler
    const parameters = []

    // Arama filtresi
    if (search) {
      query += ` AND (n.title LIKE @search OR n.summary LIKE @search OR n.content LIKE @search)`
      parameters.push({
        name: "search",
        type: sql.NVarChar,
        value: `%${search}%`,
      })
    }

    // Kategori filtresi
    if (category) {
      query += ` AND c.name = @category`
      parameters.push({
        name: "category",
        type: sql.NVarChar,
        value: category,
      })
    }

    // Durum filtresi
    if (status) {
      query += ` AND n.status = @status`
      parameters.push({
        name: "status",
        type: sql.NVarChar,
        value: status,
      })
    }

    // Toplam kayıt sayısını al
    const countQuery = query.replace(
      "SELECT n.id, n.title, n.summary, n.content, n.slug, n.status, \
             n.imageUrl, n.createdAt, n.updatedAt, n.viewCount, \
             c.name as category, c.id as categoryId, u.fullName as author, u.id as authorId",
      "SELECT COUNT(*) as total",
    )

    const countRequest = poolConnection.request()
    parameters.forEach((param) => {
      countRequest.input(param.name, param.type, param.value)
    })

    const countResult = await countRequest.query(countQuery)

    const totalItems = countResult.recordset[0].total

    // Sıralama
    query += ` ORDER BY n.${sortBy} ${sortOrder === "asc" ? "ASC" : "DESC"}`

    // Sayfalama
    const offset = (page - 1) * limit
    query += ` OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`

    // Ana sorguyu çalıştır
    const request = poolConnection.request()
    parameters.forEach((param) => {
      request.input(param.name, param.type, param.value)
    })

    const result = await request.query(query)

    // Tarihleri formatla
    const news = result.recordset.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
    }))

    // Sayfalama bilgilerini ekle
    const pagination = {
      page: Number.parseInt(page),
      limit: Number.parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    }

    res.json({
      success: true,
      data: news,
      pagination,
    })
  } catch (err) {
    next(err)
  }
}

// Belirli bir haberi getir
exports.getNewsById = async (req, res, next) => {
  try {
    const { id } = req.params

    const poolConnection = await pool

    const result = await poolConnection
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT n.id, n.title, n.summary, n.content, n.slug, n.status, 
               n.imageUrl, n.createdAt, n.updatedAt, n.viewCount,
               c.id as categoryId, c.name as category, 
               u.id as authorId, u.fullName as author
        FROM News n
        LEFT JOIN Categories c ON n.categoryId = c.id
        LEFT JOIN Users u ON n.authorId = u.id
        WHERE n.id = @id
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Haber bulunamadı",
      })
    }

    // Görüntülenme sayısını artır
    await poolConnection
      .request()
      .input("id", sql.Int, id)
      .query("UPDATE News SET viewCount = viewCount + 1 WHERE id = @id")

    const news = {
      ...result.recordset[0],
      createdAt: result.recordset[0].createdAt.toISOString(),
      updatedAt: result.recordset[0].updatedAt ? result.recordset[0].updatedAt.toISOString() : null,
    }

    res.json({
      success: true,
      data: news,
    })
  } catch (err) {
    next(err)
  }
}

// Yeni haber ekle
exports.createNews = async (req, res, next) => {
  try {
    const { title, summary, content, categoryId, status = "draft", imageUrl } = req.body

    // Validation
    if (!title || !summary || !content || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "Başlık, özet, içerik ve kategori alanları zorunludur",
      })
    }

    const poolConnection = await pool

    // Slug oluştur
    const slug = createSlug(title)

    // Haberi ekle
    const result = await poolConnection
      .request()
      .input("title", sql.NVarChar, title)
      .input("summary", sql.NVarChar, summary)
      .input("content", sql.NVarChar, content)
      .input("slug", sql.NVarChar, slug)
      .input("categoryId", sql.Int, categoryId)
      .input("status", sql.NVarChar, status)
      .input("imageUrl", sql.NVarChar, imageUrl || null)
      .input("authorId", sql.Int, req.user.id)
      .input("createdAt", sql.DateTime, new Date())
      .input("viewCount", sql.Int, 0)
      .query(`
        INSERT INTO News (title, summary, content, slug, status,categoryId, imageUrl, authorId, createdAt, viewCount)
        VALUES (@title, @summary, @content, @slug, @status,@categoryId, @imageUrl, @authorId, @createdAt, @viewCount);
        
        SELECT SCOPE_IDENTITY() AS id;
      `)





    const newsId = result.recordset[0].id

    const userNewsAddResult = await poolConnection
    .request()
    .input("newsId", sql.Int, newsId)
    .input("authorId", sql.Int, req.user.id)
    .query(`
      INSERT INTO UserNews (userId, newsId)
      VALUES (@authorId, @newsId);
    `)
    let newsCategoryAddResult;
    if(userNewsAddResult.rowsAffected[0]=1){
       newsCategoryAddResult = await poolConnection
    .request()
    .input("newsId", sql.Int, newsId)
    .input("categoryId", sql.Int, categoryId)
    .query(`
      INSERT INTO NewsCategories (newsId, categoryId)
      VALUES (@newsId, @categoryId);
    `)
    }

if(newsCategoryAddResult.rowsAffected[0]=1){
    res.status(201).json({
      success: true,
      message: "Haber başarıyla eklendi",
      data: {
        id: newsId,
        title,
        summary,
        content,
        slug,
        categoryId,
        status,
        imageUrl,
        authorId: req.user.id,
        createdAt: new Date().toISOString(),
      },
    })}
    else {
      return res.status(400).json({
        success: false,
        message: "Haber eklenirken bir hata oluştu",
      })
    }
  } catch (err) {
    next(err)
  }
}

// Haberi güncelle
exports.updateNews = async (req, res, next) => {
  try {
    const { id } = req.params
    const { title, summary, content, categoryId, status, imageUrl } = req.body

    // Validation
    if (!title || !summary || !content || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "Başlık, özet, içerik ve kategori alanları zorunludur",
      })
    }

    const poolConnection = await pool

    // Haberin var olup olmadığını kontrol et
    const checkResult = await poolConnection
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM News WHERE id = @id")

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Haber bulunamadı",
      })
    }

    // Yetki kontrolü - Sadece admin her haberi düzenleyebilir
    // Editor ise sadece kendi haberlerini düzenleyebilir
    if (req.user.roleId !== 1) {
      const authorCheck = await poolConnection
        .request()
        .input("id", sql.Int, id)
        .input("authorId", sql.Int, req.user.id)
        .query("SELECT * FROM News WHERE id = @id AND authorId = @authorId")

      if (authorCheck.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Bu haberi düzenleme yetkiniz yok",
        })
      }
    }

    // Slug oluştur
    const slug = createSlug(title)

    // Haberi güncelle
   let result= await poolConnection
      .request()
      .input("id", sql.Int, id)
      .input("title", sql.NVarChar, title)
      .input("summary", sql.NVarChar, summary)
      .input("content", sql.NVarChar, content)
      .input("slug", sql.NVarChar, slug)
      .input("categoryId", sql.Int, categoryId)
      .input("status", sql.NVarChar, status)
      .input("imageUrl", sql.NVarChar, imageUrl || null)
      .input("updatedAt", sql.DateTime, new Date())
      .query(`
        UPDATE News
        SET title = @title,
            summary = @summary,
            content = @content,
            slug = @slug,
            categoryId = @categoryId,
            status = @status,
            imageUrl = @imageUrl,
            updatedAt = @updatedAt
        WHERE id = @id
      `)

    let updateNewsCategoriesResult;

      if(result.rowsAffected[0])
      {
      updateNewsCategoriesResult = await poolConnection
    .request()
    .input("newsId", sql.Int, id)
    .input("categoryId", sql.Int, categoryId)
    .query(`
      Update NewsCategories
      Set categoryId= @categoryId
      Where newsId=@newsId;
    `)
      }
      if(updateNewsCategoriesResult.rowsAffected[0]){

    res.json({
      success: true,
      message: "Haber başarıyla güncellendi",
      data: {
        id: Number.parseInt(id),
        title,
        summary,
        content,
        slug,
        categoryId,
        status,
        imageUrl,
        updatedAt: new Date().toISOString(),
      },
    })}
    else
    {
      return res.status(400).json({
        success: false,
        message: "Haber güncellenirken bir hata oluştu",
        
      })
    } 
  } catch (err) {
    next(err)
  }
}

// Haberi sil
exports.deleteNews = async (req, res, next) => {
  try {
    const { id } = req.params

    const poolConnection = await pool

    // Haberin var olup olmadığını kontrol et
    const checkResult = await poolConnection
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM News WHERE id = @id")

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Haber bulunamadı",
      })
    }

    // Yetki kontrolü - Sadece admin her haberi silebilir
    // Editor ise sadece kendi haberlerini silebilir
    if (req.user.roleId !== 1) {
      const authorCheck = await poolConnection
        .request()
        .input("id", sql.Int, id)
        .input("authorId", sql.Int, req.user.id)
        .query("SELECT * FROM News WHERE id = @id AND authorId = @authorId")

      if (authorCheck.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Bu haberi silme yetkiniz yok",
        })
      }
    }
    let resultNewsCategory=await poolConnection.request().input("id", sql.Int, id).query("DELETE FROM NewsCategories WHERE newsId = @id")
    let resultUserNews;
    console.log(resultNewsCategory)
    if(resultNewsCategory.rowsAffected!=undefined && resultNewsCategory.rowsAffected[0]){
      resultUserNews=await poolConnection.request().input("id", sql.Int, id).query("DELETE FROM UserNews WHERE newsId = @id")
    }

     console.log(resultUserNews)
    let resultNews;
   

    if(resultUserNews.rowsAffected!=undefined && resultUserNews.rowsAffected[0]){
      resultNews=await poolConnection.request().input("id", sql.Int, id).query("DELETE FROM News WHERE id = @id")   
    }
    console.log(resultNews.rowsAffected)

    if(resultNews.rowsAffected!=undefined && resultNews.rowsAffected[0]){
      res.json({
        success: true,
        message: "Haber başarıyla silindi",
      })
    }
    else {
      return res.status(400).json({
        success: false,
        message: "Haber silinirken bir hata oluştu",
      })
    }
    // Haberi sil

   
  } catch (err) {
    next(err)
  }
}

// Tüm kategorileri getir
exports.getCategories = async (req, res, next) => {
  try {
    const poolConnection = await pool

    const result = await poolConnection.request().query("SELECT id, name FROM Categories ORDER BY name")

    res.json({
      success: true,
      data: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

// Haber durumunu güncelle
exports.updateNewsStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status || !["draft", "review", "published"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Geçerli bir durum belirtmelisiniz (draft, review, published)",
      })
    }

    const poolConnection = await pool

    // Haberin var olup olmadığını kontrol et
    const checkResult = await poolConnection
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM News WHERE id = @id")

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Haber bulunamadı",
      })
    }

    // Yetki kontrolü - Sadece admin her haberin durumunu değiştirebilir
    // Editor ise sadece kendi haberlerinin durumunu değiştirebilir
    if (req.user.roleId !== 1) {
      const authorCheck = await poolConnection
        .request()
        .input("id", sql.Int, id)
        .input("authorId", sql.Int, req.user.id)
        .query("SELECT * FROM News WHERE id = @id AND authorId = @authorId")

      if (authorCheck.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Bu haberin durumunu değiştirme yetkiniz yok",
        })
      }
    }

    // Durumu güncelle
    await poolConnection
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar, status)
      .input("updatedAt", sql.DateTime, new Date())
      .query(`
        UPDATE News
        SET status = @status,
            updatedAt = @updatedAt
        WHERE id = @id
      `)

    res.json({
      success: true,
      message: "Haber durumu başarıyla güncellendi",
      data: {
        id: Number.parseInt(id),
        status,
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
}

