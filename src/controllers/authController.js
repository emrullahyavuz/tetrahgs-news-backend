const { sql, poolPromise } = require("../config/database")
const { hashPassword, comparePassword } = require("../utils/passwordUtils")
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
} = require("../utils/tokenUtils")



const register = async (req, res) => {
    try {
      const { fullName, email, password, userType, gender } = req.body
  
      // Validate input (basic validation, frontend has Yup validation)
      if (!fullName || !email || !password || !userType || !gender) {
        return res.status(400).json({ message: "Tüm alanları doldurunuz." })
      }
  
      // Check if email already exists
      const pool = await poolPromise
      const userCheck = await pool
        .request()
        .input("email", sql.NVarChar, email)
        .query("SELECT * FROM Users WHERE email = @email")
  
      if (userCheck.recordset.length > 0) {
        return res.status(400).json({ message: "Bu email adresi zaten kullanılıyor." })
      }
  
      // Hash password
      const hashedPassword = await hashPassword(password)
  
      // Insert new user
      const result = await pool
        .request()
        .input("fullName", sql.NVarChar, fullName)
        .input("email", sql.NVarChar, email)
        .input("password", sql.NVarChar, hashedPassword)
        .input("userType", sql.NVarChar, userType)
        .input("gender", sql.NVarChar, gender)
        .query(`
          INSERT INTO Users (fullName, email, password, userType, gender, createdAt)
          VALUES (@fullName, @email, @password, @userType, @gender, GETDATE());
          `)
          
      // SELECT SCOPE_IDENTITY() AS id;
      // const userId = result.recordset[0].id
      console.log("result",result)
      const resultStatus = result.rowsAffected[0] > 0 ? "true" : "false";
      console.log("result",resultStatus)
      
      
      // Generate tokens
      // 
      // const accessToken =  generateAccessToken(userId)
      // const { refreshToken } = await generateRefreshToken(userId)
  
      if(resultStatus){
        res.status(201).json({
          message: "Kullanıcı başarıyla oluşturuldu.",
          // user: {
          //   id: userId,
          //   fullName,
          //   email,
          //   userType,
          //   gender,
          // },
          // accessToken,
          // refreshToken,
        })
      }
      else{
        // başarısız message vs.
      }
  
      
    } catch (error) {
      console.error("Register error:", error)
      res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
    }
}

const login = async (req, res) => {
  const { email, password, rememberMe = false } = req.body
  try {
    

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email ve şifre gereklidir." })
    }

    // Check if user exists
    const pool = await poolPromise
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM Users WHERE email = @email")

    const user = result.recordset[0]

    if (!user) {
      return res.status(401).json({ message: "Geçersiz email veya şifre." })
    }

    // Check password
    const isMatch = await comparePassword(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: "Geçersiz email veya şifre." })
    }
    // Generate tokens
    // const accessToken = generateAccessToken(user.id)
    const { refreshToken } = await generateRefreshToken(user.id, rememberMe)

    // Update last login
    await pool
      .request()
      .input("userId", sql.Int, user.id)
      .query("UPDATE Users SET lastLogin = GETDATE() WHERE id = @userId")


    res.json({
      message: "Giriş başarılı.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        gender: user.gender,
      },
      // accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." })
  }
}


  module.exports = {register,login}