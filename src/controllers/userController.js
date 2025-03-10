const bcrypt = require('bcryptjs');
const { pool, sql } = require('../config/database');
const { isValidEmail, isValidPassword } = require('../utils/validationUtils');
const { deleteFile, getFileUrl } = require('../utils/fileUtils');

// Get all users (admin only)
exports.getAllUsers = async (req, res, next) => {
  try {
    // Check if admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const poolConnection = await pool;
    
    // Get users
    const result = await poolConnection.request()
      .query('SELECT id, fullName, email, userType, gender, profileImage, createdAt, lastLogin FROM Users ORDER BY createdAt DESC');
    
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
    
    // Check if admin or self
    if (req.user.userType !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
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

// Update user
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, email, gender, userType } = req.body;
    
    // Check if admin or self
    const isSelf = req.user.id === parseInt(id);
    const isAdmin = req.user.userType === 'admin';
    
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    // Only admin can change userType
    if (userType && !isAdmin) {
      return res.status(403).json({ message: 'Kullanıcı tipini değiştirmek için admin yetkisi gereklidir' });
    }
    
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
        .query('SELECT * FROM Users WHERE email = @email AND id != @id');
      
      if (emailCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor' });
      }
    }
    
    // Build update query
    let updateQuery = 'UPDATE Users SET ';
    const queryParams = [];
    
    if (fullName) {
      queryParams.push('fullName = @fullName');
    }
    
    if (email) {
      queryParams.push('email = @email');
    }
    
    if (gender) {
      queryParams.push('gender = @gender');
    }
    
    if (userType && isAdmin) {
      queryParams.push('userType = @userType');
    }
    
    queryParams.push('updatedAt = @updatedAt');
    
    updateQuery += queryParams.join(', ') + ' WHERE id = @id';
    
    // Update user
    const request = poolConnection.request()
      .input('id', sql.Int, id)
      .input('updatedAt', sql.DateTime, new Date());
    
    if (fullName) request.input('fullName', sql.NVarChar, fullName);
    if (email) request.input('email', sql.NVarChar, email);
    if (gender) request.input('gender', sql.NVarChar, gender);
    if (userType && isAdmin) request.input('userType', sql.NVarChar, userType);
    
    await request.query(updateQuery);
    
    // Get updated user
    const result = await poolConnection.request()
      .input('id', sql.Int, id)
      .query('SELECT id, fullName, email, userType, gender, profileImage, createdAt, updatedAt, lastLogin FROM Users WHERE id = @id');
    
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
    
    // Check if admin or self
    if (req.user.userType !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
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