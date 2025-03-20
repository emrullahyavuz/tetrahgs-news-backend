const { pool, sql } = require("../config/database")

// Dashboard istatistiklerini getir
exports.getDashboardStats = async (req, res, next) => {
  try {
    const poolConnection = await pool

    // Toplam haber sayısı
    const totalNewsResult = await poolConnection.request().query("SELECT COUNT(*) as total FROM News")
    const totalNews = totalNewsResult.recordset[0].total

    // Toplam görüntülenme sayısı
    const totalViewsResult = await poolConnection.request().query("SELECT SUM(viewCount) as total FROM News")
    const totalViews = totalViewsResult.recordset[0].total || 0

    // Toplam kullanıcı sayısı
    const totalUsersResult = await poolConnection.request().query("SELECT COUNT(*) as total FROM Users")
    const totalUsers = totalUsersResult.recordset[0].total

    // Son 30 gündeki değişim oranları (örnek hesaplama)
    // Gerçek uygulamada bu hesaplamalar daha karmaşık olabilir

    // Son 30 gündeki haber sayısı
    const last30DaysNewsResult = await poolConnection
      .request()
      .query("SELECT COUNT(*) as total FROM News WHERE createdAt >= DATEADD(day, -30, GETDATE())")
    const last30DaysNews = last30DaysNewsResult.recordset[0].total

    // Son 30 gündeki görüntülenme sayısı
    const last30DaysViewsResult = await poolConnection
      .request()
      .query(
        "SELECT SUM(viewCount) as total FROM News WHERE createdAt >= DATEADD(day, -30, GETDATE()) OR updatedAt >= DATEADD(day, -30, GETDATE())",
      )
    const last30DaysViews = last30DaysViewsResult.recordset[0].total || 0

    // Son 30 gündeki kullanıcı sayısı
    const last30DaysUsersResult = await poolConnection
      .request()
      .query("SELECT COUNT(*) as total FROM Users WHERE createdAt >= DATEADD(day, -30, GETDATE())")
    const last30DaysUsers = last30DaysUsersResult.recordset[0].total

    // Değişim oranlarını hesapla
    const newsChangePercent = totalNews > 0 ? Math.round((last30DaysNews / totalNews) * 100) : 0
    const viewsChangePercent = totalViews > 0 ? Math.round((last30DaysViews / totalViews) * 100) : 0
    const usersChangePercent = totalUsers > 0 ? Math.round((last30DaysUsers / totalUsers) * 100) : 0

    // Haber etkileşimi (örnek hesaplama: görüntülenme / haber sayısı)
    const engagementRate = totalNews > 0 ? Math.round((totalViews / totalNews) * 100) / 100 : 0

    // Son 30 gündeki etkileşim
    const last30DaysEngagement = last30DaysNews > 0 ? Math.round((last30DaysViews / last30DaysNews) * 100) / 100 : 0

    // Etkileşim değişim oranı
    const engagementChangePercent =
      engagementRate > 0 ? Math.round(((last30DaysEngagement - engagementRate) / engagementRate) * 100) : 0

    // İstatistikleri döndür
    res.json({
      success: true,
      data: {
        totalNews,
        totalViews,
        totalUsers,
        engagementRate,
        newsChangePercent,
        viewsChangePercent,
        usersChangePercent,
        engagementChangePercent,
      },
    })
  } catch (err) {
    next(err)
  }
}

// Popüler kategorileri getir
exports.getPopularCategories = async (req, res, next) => {
  try {
    const poolConnection = await pool

    // Her kategori için haber sayısını getir ve sırala
    const result = await poolConnection.request().query(`
      SELECT c.id, c.name, COUNT(n.id) as count
      FROM Categories c
      LEFT JOIN News n ON c.id = n.categoryId
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `)

    // En popüler 5 kategoriyi al
    const categories = result.recordset.slice(0, 5)

    // Maksimum haber sayısını bul
    const maxCount = Math.max(...categories.map((c) => c.count))

    // Yüzdeleri hesapla
    const categoriesWithPercentage = categories.map((category) => ({
      id: category.id,
      name: category.name,
      count: category.count,
      percentage: maxCount > 0 ? Math.round((category.count / maxCount) * 100) : 0,
    }))

    res.json({
      success: true,
      data: categoriesWithPercentage,
    })
  } catch (err) {
    next(err)
  }
}

// Görüntülenme analizini getir
exports.getViewsAnalytics = async (req, res, next) => {
  try {
    const { period = "week" } = req.query
    const poolConnection = await pool

    let dateFormat
    let dateQuery

    // Periyoda göre tarih formatını ve sorguyu ayarla
    if (period === "week") {
      dateFormat = "%Y-%m-%d" // Günlük
      dateQuery = "WHERE createdAt >= DATEADD(day, -7, GETDATE())"
    } else if (period === "month") {
      dateFormat = "%Y-%m-%d" // Günlük
      dateQuery = "WHERE createdAt >= DATEADD(day, -30, GETDATE())"
    } else if (period === "quarter") {
      dateFormat = "%Y-%m" // Aylık
      dateQuery = "WHERE createdAt >= DATEADD(month, -3, GETDATE())"
    } else {
      return res.status(400).json({
        success: false,
        message: "Geçersiz periyot. Geçerli değerler: week, month, quarter",
      })
    }

    // Görüntülenme verilerini getir
    const result = await poolConnection.request().query(`
      SELECT 
        FORMAT(createdAt, '${dateFormat}') as date,
        SUM(viewCount) as views
      FROM News
      ${dateQuery}
      GROUP BY FORMAT(createdAt, '${dateFormat}')
      ORDER BY date
    `)

    res.json({
      success: true,
      data: result.recordset,
    })
  } catch (err) {
    next(err)
  }
}

