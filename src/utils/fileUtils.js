const fs = require('fs');
const path = require('path');
const { UPLOAD_PATH } = require('../config/config');

// Delete file
const deleteFile = (filename) => {
  try {
    const filePath = path.join(UPLOAD_PATH, filename);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Dosya silme hatası:', err);
    return false;
  }
};

// Get file URL
const getFileUrl = (req, filename) => {
  if (!filename) return null;
  
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/${UPLOAD_PATH}${filename}`;
};

module.exports = {
  deleteFile,
  getFileUrl
};