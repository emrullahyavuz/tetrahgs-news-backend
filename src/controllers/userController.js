const bcrypt = require('bcryptjs');
const { pool, sql } = require('../config/database');
const { isValidEmail, isValidPassword } = require('../utils/validationUtils');
const { deleteFile, getFileUrl } = require('../utils/fileUtils');
const { hashPassword } = require('../utils/passwordUtils');

// Get all users (admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
    // // Check if admin
    // business kontrolünüde yap.
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    // }
    
    const poolConnection = await pool;
    
    // Get users
    const result = await poolConnection.request()
      .query(`SELECT id, fullName, email, userType, gender,status,profileImage, createdAt, lastLogin,
        (SELECT COUNT(*) 
     FROM News
     WHERE id IN (SELECT newsId FROM UserNews WHERE userId = u.id)) as newsCount
         FROM Users as u ORDER BY createdAt DESC`);	
    
    // Add profile image URL
    const users = result.recordset.map(user => ({
      ...user,
      profileImage: getFileUrl(req, user.profileImage)
    }));
    
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

// Get user by ID
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // // Check if admin or self
    // if (req.user.userType !== 'admin' && req.user.id !== parseInt(id)) {
    //   return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    // }
    
    const poolConnection = await pool;
    
    // Get user
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT id, fullName, email, userType, gender, profileImage, createdAt, lastLogin FROM Users WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    const user = result.recordset[0];
    
    // Add profile image URL
    user.profileImage = getFileUrl(req, user.profileImage);
    
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Geçerli bir kullanıcı ID'si girilmelidir." });
    }

    const { fullName, email, gender, userType, status} = req.body;

    const poolConnection = await pool;

    // Check if user exists
    const userCheck = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Users WHERE id = @id');

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Check if email is already taken
    if (email && email !== userCheck.recordset[0].email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Geçerli bir email adresi giriniz' });
      }

      const emailCheck = await poolConnection.request()
        .input('email', sql.NVarChar, email)
        .input('id', sql.Int, id)  
        .query('SELECT * FROM Users WHERE email = @email AND id != @id');

      if (emailCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor' });
      }
    }

    // Build update query
    let updateQuery = 'UPDATE Users SET ';
    const queryParams = [];

    if (fullName) queryParams.push('fullName = @fullName');
    if (email) queryParams.push('email = @email');
    if (gender) queryParams.push('gender = @gender');
    if (userType) queryParams.push('userType = @userType');
    if (status) queryParams.push('status = @status');

    queryParams.push('updatedAt = @updatedAt');

    updateQuery += queryParams.join(', ') + ' WHERE id = @id';

    // Update user
    const request = poolConnection.request()
      .input('id', sql.Int, id) // Burada id'yi ekledik
      .input('updatedAt', sql.DateTime, new Date());

    if (fullName) request.input('fullName', sql.NVarChar, fullName);
    if (email) request.input('email', sql.NVarChar, email);
    if (gender) request.input('gender', sql.NVarChar, gender);
    if (userType) request.input('userType', sql.NVarChar, userType);
    if (status) request.input('status', sql.NVarChar, status);

    await request.query(updateQuery);

    // Get updated user
    const result = await poolConnection.request()
      .input('id', sql.Int, id) // Burada da id ekledik
      .query('SELECT id, fullName, email, userType, status, gender, profileImage, createdAt, updatedAt, lastLogin FROM Users WHERE id = @id');

    const user = result.recordset[0];

    // Add profile image URL
    user.profileImage = getFileUrl(req, user.profileImage);

    res.json({
      message: 'Kullanıcı başarıyla güncellendi',
      user
    });
  } catch (err) {
    next(err);
  }
};

// Update password
exports.updatePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    // Check if self
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Mevcut şifre ve yeni şifre gereklidir' });
    }
    
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ 
        message: 'Şifre en az 8 karakter uzunluğunda olmalı ve en az bir büyük harf, bir küçük harf ve bir rakam içermelidir' 
      });
    }
    
    const poolConnection = await pool;
    
    // Get user
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Users WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    const user = result.recordset[0];
    
    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Mevcut şifre yanlış' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await poolConnection.request()
      .input('id', sql.Int, id)
      .input('password', sql.NVarChar, hashedPassword)
      .input('updatedAt', sql.DateTime, new Date())
      .query('UPDATE Users SET password = @password, updatedAt = @updatedAt WHERE id = @id');
    
    res.json({ message: 'Şifre başarıyla güncellendi' });
  } catch (err) {
    next(err);
  }
};

// Upload profile image
exports.uploadProfileImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if self or admin
    if (req.user.id !== parseInt(id) && req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Profil resmi yüklenemedi' });
    }
    
    const poolConnection = await pool;
    
    // Get user
    const userResult = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT profileImage FROM Users WHERE id = @id');
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    // Delete old profile image
    const oldProfileImage = userResult.recordset[0].profileImage;
    if (oldProfileImage) {
      deleteFile(oldProfileImage);
    }
    
    // Update profile image
    await poolConnection.request()
      .input('id', sql.Int, id)
      .input('profileImage', sql.NVarChar, req.file.filename)
      .input('updatedAt', sql.DateTime, new Date())
      .query('UPDATE Users SET profileImage = @profileImage, updatedAt = @updatedAt WHERE id = @id');
    
    res.json({
      message: 'Profil resmi başarıyla güncellendi',
      profileImage: getFileUrl(req, req.file.filename)
    });
  } catch (err) {
    next(err);
  }
};

// Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // // Check if admin or self
    // if (req.user.userType !== 'admin' && req.user.id !== parseInt(id)) {
    //   return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    // }
    
    const poolConnection = await pool;
    
    // Get user
    const userResult = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT profileImage FROM Users WHERE id = @id');
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    // Delete profile image
    const profileImage = userResult.recordset[0].profileImage;
    if (profileImage) {
      deleteFile(profileImage);
    }
    
    // Delete user
    await poolConnection.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Users WHERE id = @id');
    
    res.json({ message: 'Kullanıcı başarıyla silindi' });
  } catch (err) {
    next(err);
  }
};

// Create user (admin only)
exports.createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, gender, userType, status } = req.body;
    
    // // Check if admin
    // if (req.user.userType !== 'admin') {
    //   return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    // }
    
    // Validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Ad Soyad, email ve şifre alanları zorunludur' });
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
    
    // Check if email is already taken
    const emailCheck = await poolConnection.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');
    
    if (emailCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor' });
    }
    
    // Hash password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
    const hashedPassword = await hashPassword(password)
    
    // Insert user
    const result = await poolConnection.request()
      .input('fullName', sql.NVarChar, fullName)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('gender', sql.NVarChar, gender || 'male')
      .input('userType', sql.NVarChar, userType || 'personal')
      .input('status', sql.NVarChar, status || 'active')
      .input('createdAt', sql.DateTime, new Date())
      .query(`
        INSERT INTO Users (fullName, email, password, gender, userType, status, createdAt)
        VALUES (@fullName, @email, @password, @gender, @userType, @status, @createdAt);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    const userId = result.recordset[0].id;
    
    // Get created user
    const userResult = await poolConnection.request()
      .input('id', sql.Int, userId)
      .query('SELECT id, fullName, email, userType, gender, status, profileImage, createdAt FROM Users WHERE id = @id');
    
    const user = userResult.recordset[0];
    
    // Add profile image URL
    user.profileImage = getFileUrl(req, user.profileImage);
    
    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu',
      user
    });
  } catch (err) {
    next(err);
  }
};