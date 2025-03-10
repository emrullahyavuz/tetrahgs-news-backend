const sql = require("mssql")
require("dotenv").config()

// Configuration with explicit credentials from the user's example and fallback for Windows Authentication
const config = {
  user: "ga",
  password: "BUSONolsun_58@!#$",
  server: "localhost",
  database: "tutorial",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
}



// Create a connection pool
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Connected to MSSQL Database successfully")
    return pool
  })
  .catch((err) => {
    console.error("Database connection failed:", err)
    process.exit(1)
  })

// Get the pool instance
const getPool = async () => {
  return await poolPromise
}

// Example function to get all users
async function getUsers() {
  try {
    const pool = await poolPromise
    console.log("Connection successful!")

    // First check if the Users table exists
    const tableCheck = await pool.request().query(`
      SELECT OBJECT_ID('Users') as tableExists
    `)

    if (!tableCheck.recordset[0].tableExists) {
      console.log("Users table does not exist yet. Please run the database setup first.")
      return []
    }

    const result = await pool.request().query("SELECT * FROM Users")
    

    return result.recordset
  } catch (err) {
    console.error("Error:", err)
    throw err
  }
}

// Connect to database (for backward compatibility)
async function connectDB() {
  try {
    await poolPromise
    return poolPromise
  } catch (err) {
    console.error("Database connection failed:", err)
    throw err
  }
}

module.exports = {
  connectDB,
  getPool,
  pool,
  sql,
  getUsers,
  poolPromise,
}

