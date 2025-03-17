const bcrypt = require('bcryptjs');
const { pool, sql } = require('../config/database');
const { 
  generateToken, 
  generateRefreshToken, 
  saveRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens
} = require('../utils/tokenUtils');
const { isValidEmail, isValidPassword } = require('../utils/validationUtils');

// Register user
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, gender } = req.body;
    
    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Tüm alanları doldurunuz' });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Geçerli bir email adresi giriniz' });
    }
    
    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        message: 'Şifre en az 8 karakter uzunluğunda olmalı ve en az bir büyük harf, bir küçük harf ve bir rakam içermelidir' 
      });
    }
    
    const poolConnection = await pool;
    
    // Check if user exists
    const userCheck = await poolConnection.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');
    
    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

   
    
    // Create user
    const result = await poolConnection.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('gender', sql.NVarChar, gender || null)
      .input('userType', sql.NVarChar, 'user')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Users (fullName, email, password, gender, userType, createdAt)
        VALUES (@fullName, @email, @password, @gender, @userType, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    const userId = result.recordset[0].id;
    
    // Get user
    const userResult = await poolConnection.request()
      .input('id', sql.Int, userId)
      .query('SELECT id, fullName, email, userType, gender, profileImage, createdAt FROM Users WHERE id = @id');
    
    const user = userResult.recordset[0];
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user.id);
    
    // Save refresh token
    await saveRefreshToken(user.id, refreshToken);
    
    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu',
      user,
      token,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
};

// Register admin
exports.registerAdmin = async (req, res, next) => {
  try {
    const { fullName, email, password, gender } = req.body;
    
    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Tüm alanları doldurunuz' });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Geçerli bir email adresi giriniz' });
    }
    
    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        message: 'Şifre en az 8 karakter uzunluğunda olmalı ve en az bir büyük harf, bir küçük harf ve bir rakam içermelidir' 
      });
    }
    
    const poolConnection = await pool;
    
    // Check if user exists
    const userCheck = await poolConnection.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');
    
    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create admin user
    const result = await poolConnection.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('gender', sql.NVarChar, gender || null)
      .input('userType', sql.NVarChar, 'admin')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Users (fullName, email, password, gender, userType, createdAt)
        VALUES (@fullName, @email, @password, @gender, @userType, @createdAt);
        
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    const userId = result.recordset[0].id;
    
    // Get user
    const userResult = await poolConnection.request()
      .input('id', sql.Int, userId)
      .query('SELECT id, fullName, email, userType, gender, profileImage, createdAt FROM Users WHERE id = @id');
    
    const user = userResult.recordset[0];
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user.id);
    
    // Save refresh token
    await saveRefreshToken(user.id, refreshToken);
    
    res.status(201).json({
      message: 'Admin kullanıcı başarıyla oluşturuldu',
      user,
      token,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
};

// Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email ve şifre gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Check if user exists
    const result = await poolConnection.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');
    
    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'Geçersiz email veya şifre' });
    }
    
    const user = result.recordset[0];
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Geçersiz email veya şifre' });
    }
    
    // Update last login
    await poolConnection.request()
      .input('id', sql.Int, user.id)
      .input('lastLogin', sql.DateTime, new Date())
      .query('UPDATE Users SET lastLogin = @lastLogin WHERE id = @id');
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user.id);
    
    // Save refresh token
    await saveRefreshToken(user.id, refreshToken);
    
    // Remove password from response
    delete user.password;
    
    res.json({
      message: 'Giriş başarılı',
      user,
      token,
      refreshToken
    });
  } catch (err) {
    next(err);
  }
};

// Refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token gereklidir' });
    }
    
    // Verify refresh token
    const user = await verifyRefreshToken(refreshToken);
    console.log(user)
    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user.id);
    
    // Delete old refresh token
    await deleteRefreshToken(refreshToken);
    
    // Save new refresh token
    await saveRefreshToken(user.id, newRefreshToken);
    
    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    if (err.message === 'Geçersiz refresh token' || err.message === 'Kullanıcı bulunamadı' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Geçersiz refresh token' });
    }
    next(err);
  }
};

// Logout
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token gereklidir' });
    }
    
    // Delete refresh token
    await deleteRefreshToken(refreshToken);
    
    res.json({ message: 'Çıkış başarılı' });
  } catch (err) {
    next(err);
  }
};

// Logout from all devices
exports.logoutAll = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Delete all refresh tokens for user
    await deleteAllUserRefreshTokens(userId);
    
    res.json({ message: 'Tüm cihazlardan çıkış yapıldı' });
  } catch (err) {
    next(err);
  }
};

// Get current user
exports.getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.body.id;
    
    const poolConnection = await pool;
    
    // Get user
    const result = await poolConnection.request()
      .input('id', sql.Int, userId)
      .query('SELECT id, fullName, email, userType, gender, profileImage, createdAt, lastLogin FROM Users WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    const user = result.recordset[0];
    
    res.json({ user });
  } catch (err) {
    next(err);
  }
};