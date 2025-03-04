const sql = require("mssql/msnodesqlv8")



const config = {
  
  server: "localhost",
  database: "technews",
  driver: "msnodesqlv8",
  options: {
    encrypt: true,
    trustServerCertificate: true,
    trustedConnection: true,
  },
}

async function connectDB() {
  try {
    await sql.connect(config)
    console.log("Connected to MSSQL Database")
  } catch (err) {
    console.error("Database connection failed:", err)
    process.exit(1)
  }
}

module.exports = {
  connectDB,
  sql,
}

