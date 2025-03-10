const { pool, sql } = require('../config/database');
const { deleteFile, getFileUrl } = require('../utils/fileUtils');

// Get all settings
exports.getAllSettings = async (req, res, next) => {
  try {
    const poolConnection = await pool;
    
    // Get settings
    const result = await poolConnection.request()
      .query('SELECT * FROM Settings');
    
    // Convert to object
    const settings = {};
    result.recordset.forEach(setting => {
      settings[setting.key] = setting.value;
    });
    
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

// Get setting by key
exports.getSettingByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    
    const poolConnection = await pool;
    
    // Get setting
    const result = await poolConnection.request()
      .input('key', sql.NVarChar, key)
      .query('SELECT * FROM Settings WHERE [key] = @key');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Ayar bulunamadı' });
    }
    
    res.json({ setting: result.recordset[0] });
  } catch (err) {
    next(err);
  }
};

// Update settings
exports.updateSettings = async (req, res, next) => {
  try {
    // Check if admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { settings } = req.body;
    
    // Validation
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Geçerli ayarlar gereklidir' });
    }
    
    const poolConnection = await pool;
    
    // Update settings
    for (const [key, value] of Object.entries(settings)) {
      // Check if setting exists
      const settingCheck = await poolConnection.request()
        .input('key', sql.NVarChar, key)
        .query('SELECT * FROM Settings WHERE [key] = @key');
      
      if (settingCheck.recordset.length === 0) {
        // Create setting
        await poolConnection.request()
          .input('key', sql.NVarChar, key)
          .input('value', sql.NVarChar, value)
          .query('INSERT INTO Settings ([key], value) VALUES (@key, @value)');
      } else {
        // Update setting
        await poolConnection.request()
          .input('key', sql.NVarChar, key)
          .input('value', sql.NVarChar, value)
          .query('UPDATE Settings SET value = @value WHERE [key] = @key');
      }
    }
    
    // Get updated settings
    const result = await poolConnection.request()
      .query('SELECT * FROM Settings');
    
    // Convert to object
    const updatedSettings = {};
    result.recordset.forEach(setting => {
      updatedSettings[setting.key] = setting.value;
    });
    
    res.json({
      message: 'Ayarlar başarıyla güncellendi',
      settings: updatedSettings
    });
  } catch (err) {
    next(err);
  }
};

// Upload site logo
exports.uploadSiteLogo = async (req, res, next) => {
  try {
    // Check if admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Logo yüklenemedi' });
    }
    
    const poolConnection = await pool;
    
    // Get current logo
    const logoResult = await poolConnection.request()
      .query("SELECT value FROM Settings WHERE [key] = 'site_logo'");
    
    // Delete old logo
    if (logoResult.recordset.length > 0 && logoResult.recordset[0].value) {
      deleteFile(logoResult.recordset[0].value);
    }
    
    // Update logo setting
    await poolConnection.request()
      .input('key', sql.NVarChar, 'site_logo')
      .input('value', sql.NVarChar, req.file.filename)
      .query(`
        IF EXISTS (SELECT * FROM Settings WHERE [key] = @key)
          UPDATE Settings SET value = @value WHERE [key] = @key
        ELSE
          INSERT INTO Settings ([key], value) VALUES (@key, @value)
      `);
    
    res.json({
      message: 'Logo başarıyla güncellendi',
      logo: getFileUrl(req, req.file.filename)
    });
  } catch (err) {
    next(err);
  }
};

// Delete setting
exports.deleteSetting = async (req, res, next) => {
  try {
    // Check if admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
    }
    
    const { key } = req.params;
    
    const poolConnection = await pool;
    
    // Check if setting exists
    const settingCheck = await poolConnection.request()
      .input('key', sql.NVarChar, key)
      .query('SELECT * FROM Settings WHERE [key] = @key');
    
    if (settingCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Ayar bulunamadı' });
    }
    
    // Delete setting
    await poolConnection.request()
      .input('key', sql.NVarChar, key)
      .query('DELETE FROM Settings WHERE [key] = @key');
    
    res.json({ message: 'Ayar başarıyla silindi' });
  } catch (err) {
    next(err);
  }
};