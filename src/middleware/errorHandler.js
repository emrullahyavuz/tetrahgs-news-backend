const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  // SQL Server hata kodlarını kontrol et
  if (err.number) {
    // Duplicate key error
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({
        message: 'Bu kayıt zaten mevcut.',
        error: err.message
      });
    }
    
    // Foreign key constraint error
    if (err.number === 547) {
      return res.status(409).json({
        message: 'Bu kayıt başka bir kayıtla ilişkili olduğu için işlem yapılamaz.',
        error: err.message
      });
    }
  }
  
  // Default error message
  res.status(500).json({
    message: 'Sunucu hatası',
    error: process.env.NODE_ENV === 'production' ? 'Bir hata oluştu' : err.message
  });
};

module.exports = errorHandler;