const multer = require("multer")
const errorHandler = (err, req, res, next) => {
  console.error(err.stack)

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File is too large. Maximum size is 5MB",
      })
    }
    return res.status(400).json({
      message: "File upload error",
    })
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: err.message,
    })
  }

  res.status(500).json({
    message: "Internal server error",
  })
}

module.exports = errorHandler
