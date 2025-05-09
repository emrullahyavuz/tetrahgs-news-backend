const jwt = require("jsonwebtoken")
const { pool, sql } = require("../config/database")
const { JWT_SECRET } = require('../config/config');




const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Kimlik doğrulama başarısız' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Geçersiz veya süresi dolmuş token' });
  }
};

// Kullanıcı kimlik doğrulama middleware'i
const protect = async (req, res, next) => {
  let token

  // Token'ı header'dan al
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }
  // Token'ı cookie'den al
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token
  }

  // Token yoksa erişimi reddet
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Bu işlemi gerçekleştirmek için giriş yapmalısınız",
    })
  }

  try {
    // Token'ı doğrula
    const decoded = jwt.verify(token, JWT_SECRET)

    // Kullanıcıyı ve rolünü veritabanından al
    const poolConnection = await pool
    const result = await poolConnection
      .request()
      .input("id", sql.Int, decoded.id)
      .query(`
        SELECT u.id, u.fullName, u.email, u.role as roleId, r.roleName
        FROM Users u
        LEFT JOIN Roles r ON u.role = r.roleId
        WHERE u.id = @id
      `)

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Geçersiz token. Lütfen tekrar giriş yapın.",
      })
    }

    // Kullanıcı bilgilerini request nesnesine ekle
    req.user = result.recordset[0]
    next()
  } catch (error) {
    console.error("Kimlik doğrulama hatası:", error)
    return res.status(401).json({
      success: false,
      message: "Geçersiz token. Lütfen tekrar giriş yapın.",
    })
  }
}

// Belirli rollere sahip kullanıcıları kontrol eden middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Bu işlemi gerçekleştirmek için giriş yapmalısınız",
      })
    }

    if (!roles.includes(req.user.roleId)) {
      return res.status(403).json({
        success: false,
        message: "Bu işlemi gerçekleştirmek için yeterli yetkiye sahip değilsiniz",
      })
    }

    next()
  }
}

// Admin rolü kontrolü (roleId = 1)
const admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Bu işlemi gerçekleştirmek için giriş yapmalısınız",
    })
  }

  if (req.user.roleId !== 1) {
    return res.status(403).json({
      success: false,
      message: "Bu işlemi gerçekleştirmek için admin yetkisine sahip olmalısınız",
    })
  }

  next()
}

// Editor rolü kontrolü (roleId = 1 veya 2)
const editor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Bu işlemi gerçekleştirmek için giriş yapmalısınız",
    })
  }

  if (req.user.roleId !== 1 && req.user.roleId !== 2) {
    return res.status(403).json({
      success: false,
      message: "Bu işlemi gerçekleştirmek için editor veya admin yetkisine sahip olmalısınız",
    })
  }

  next()
}

module.exports = {
  authenticate,
  protect,
  authorize,
  admin,
  editor,
}

