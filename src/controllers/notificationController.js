const { pool, sql } = require("../config/database")

// Kullanıcının bildirimlerini getir
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id
    const { limit = 10, offset = 0, unreadOnly = false } = req.query

    const poolConnection = await pool

    // Bildirim sayısını al
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM Notifications 
      WHERE userId = @userId
    `

    if (unreadOnly === "true") {
      countQuery += " AND isRead = 0"
    }

    const countResult = await poolConnection.request().input("userId", sql.Int, userId).query(countQuery)

    const totalItems = countResult.recordset[0].total

    // Bildirimleri getir
    let query = `
      SELECT n.id, n.title, n.message, n.type, n.entityId, n.isRead, n.createdAt,
             nt.icon
      FROM Notifications n
      LEFT JOIN NotificationTypes nt ON n.type = nt.name
      WHERE n.userId = @userId
    `

    if (unreadOnly === "true") {
      query += " AND n.isRead = 0"
    }

    query += " ORDER BY n.createdAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY"

    const result = await poolConnection
      .request()
      .input("userId", sql.Int, userId)
      .input("offset", sql.Int, Number.parseInt(offset))
      .input("limit", sql.Int, Number.parseInt(limit))
      .query(query)

    // Bildirimleri formatla
    const notifications = result.recordset.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      timeAgo: getTimeAgo(notification.createdAt),
    }))

    // Okunmamış bildirim sayısını al
    const unreadCountResult = await poolConnection
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT COUNT(*) as count FROM Notifications WHERE userId = @userId AND isRead = 0")

    const unreadCount = unreadCountResult.recordset[0].count

    res.json({
      success: true,
      data: notifications,
      pagination: {
        totalItems,
        unreadCount,
      },
    })
  } catch (err) {
    console.error("Bildirimler getirilirken hata:", err)
    next(err)
  }
}

// Bildirimi okundu olarak işaretle
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const poolConnection = await pool

    // Bildirimin kullanıcıya ait olup olmadığını kontrol et
    const checkResult = await poolConnection
      .request()
      .input("id", sql.Int, id)
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Notifications WHERE id = @id AND userId = @userId")

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bildirim bulunamadı",
      })
    }

    // Bildirimi okundu olarak işaretle
    await poolConnection.request().input("id", sql.Int, id).query("UPDATE Notifications SET isRead = 1 WHERE id = @id")

    res.json({
      success: true,
      message: "Bildirim okundu olarak işaretlendi",
    })
  } catch (err) {
    console.error("Bildirim okundu olarak işaretlenirken hata:", err)
    next(err)
  }
}

// Tüm bildirimleri okundu olarak işaretle
exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id

    const poolConnection = await pool

    // Kullanıcının tüm bildirimlerini okundu olarak işaretle
    await poolConnection
      .request()
      .input("userId", sql.Int, userId)
      .query("UPDATE Notifications SET isRead = 1 WHERE userId = @userId")

    res.json({
      success: true,
      message: "Tüm bildirimler okundu olarak işaretlendi",
    })
  } catch (err) {
    console.error("Tüm bildirimler okundu olarak işaretlenirken hata:", err)
    next(err)
  }
}

// Bildirimi sil
exports.deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const poolConnection = await pool

    // Bildirimin kullanıcıya ait olup olmadığını kontrol et
    const checkResult = await poolConnection
      .request()
      .input("id", sql.Int, id)
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Notifications WHERE id = @id AND userId = @userId")

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bildirim bulunamadı",
      })
    }

    // Bildirimi sil
    await poolConnection.request().input("id", sql.Int, id).query("DELETE FROM Notifications WHERE id = @id")

    res.json({
      success: true,
      message: "Bildirim silindi",
    })
  } catch (err) {
    console.error("Bildirim silinirken hata:", err)
    next(err)
  }
}

// Yeni bildirim oluştur (sistem içi kullanım için)
exports.createNotification = async (userId, title, message, type, entityId = null) => {
  try {
    const poolConnection = await pool

    await poolConnection
      .request()
      .input("userId", sql.Int, userId)
      .input("title", sql.NVarChar, title)
      .input("message", sql.NVarChar, message)
      .input("type", sql.NVarChar, type)
      .input("entityId", sql.Int, entityId)
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Notifications (userId, title, message, type, entityId, createdAt)
        VALUES (@userId, @title, @message, @type, @entityId, @createdAt)
      `)

    return true
  } catch (err) {
    console.error("Bildirim oluşturulurken hata:", err)
    return false
  }
}

// Zaman farkını hesapla (örn: "5 dakika önce", "1 saat önce")
function getTimeAgo(date) {
  const now = new Date()
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000)

  if (diffInSeconds < 60) {
    return `${diffInSeconds} saniye önce`
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} dakika önce`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} saat önce`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return `${diffInDays} gün önce`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} ay önce`
  }

  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} yıl önce`
}

module.exports.createNotificationForUser = exports.createNotification

