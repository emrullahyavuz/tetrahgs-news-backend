const jwt = require('jsonwebtoken');
const { pool, sql } = require('../config/database');
const {JWT_SECRET,JWT_REFRESH_SECRET} = require('../config/config')

// Kullanıcı kimlik doğrulama middleware'i
exports.protect = async (req, res, next) => {
  let token;

  // Token'ı header'dan al
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Token'ı cookie'den al
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  console.log("token", token)
  // Token yoksa erişimi reddet
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Bu işlemi gerçekleştirmek için giriş yapmalısınız'
    });
  }

  try {
    // Token'ı doğrula
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("decoded", decoded)
    

    // Kullanıcıyı ve rolünü veritabanından al
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('id', sql.Int, decoded.id)
      .query(`
        SELECT u.id, u.fullName, u.email, u.role, r.roleName
        FROM Users u
        LEFT JOIN Roles r ON u.role = r.roleId
        WHERE u.id = @id
      `);
      console.log(result)
       
    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz token. Lütfen tekrar giriş yapın.'
      });
    }

    // Kullanıcı bilgilerini request nesnesine ekle
    req.user = result.recordset[0];
    next();
  } catch (error) {
    console.error('Kimlik doğrulama hatası:', error);
    return res.status(401).json({
      success: false,
      message: 'Geçersiz token. Lütfen tekrar giriş yapın.'
    });
  }
};

// İsteğe bağlı kimlik doğrulama middleware'i
exports.optionalAuth = async (req, res, next) => {
  let token;

  // Token'ı header'dan al
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Token'ı cookie'den al
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Token yoksa bir sonraki middleware'e geç
  if (!token) {
    return next();
  }

  try {
    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kullanıcıyı ve rolünü veritabanından al
    const poolConnection = await pool;
    const result = await poolConnection.request()
      .input('id', sql.Int, decoded.id)
      .query(`
        SELECT u.id, u.fullName, u.email, u.roleId, r.roleName
        FROM Users u
        LEFT JOIN Roles r ON u.roleId = r.roleId
        WHERE u.id = @id
      `);

    if (result.recordset.length > 0) {
      // Kullanıcı bilgilerini request nesnesine ekle
      req.user = result.recordset[0];
      
    }

    next();
  } catch (error) {
    // Token geçersizse bile bir sonraki middleware'e geç
    next();
  }
};

// Belirli bir role sahip kullanıcıları kontrol eden middleware
exports.hasRole = (...roleIds) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Bu işlemi gerçekleştirmek için giriş yapmalısınız'
      });
    }

    if (!roleIds.includes(req.user.roleId)) {
      return res.status(403).json({
        success: false,
        message: 'Bu işlemi gerçekleştirmek için yeterli yetkiye sahip değilsiniz'
      });
    }

    next();
  };
};

// Admin rolü kontrolü (roleId = 1 varsayılarak)
exports.admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Bu işlemi gerçekleştirmek için giriş yapmalısınız'
    });
  }

  if (req.user.roleId !== 1) {
    return res.status(403).json({
      success: false,
      message: 'Bu işlemi gerçekleştirmek için admin yetkisine sahip olmalısınız'
    });
  }

  next();
};

// Editor rolü kontrolü (roleId = 2 varsayılarak)
exports.editor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Bu işlemi gerçekleştirmek için giriş yapmalısınız'
    });
  }

  if (req.user.roleId !== 1 && req.user.roleId !== 2) {
    return res.status(403).json({
      success: false,
      message: 'Bu işlemi gerçekleştirmek için editor veya admin yetkisine sahip olmalısınız'
    });
  }

  next();
};