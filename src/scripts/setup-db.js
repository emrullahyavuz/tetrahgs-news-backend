/**
 * Database setup script for TeknoHaber
 *
 * This script creates the database and tables if they don't exist
 * and populates them with initial data.
 */

const sql = require("mssql")
const fs = require("fs")
const path = require("path")
const bcrypt = require("bcrypt") // Import bcrypt
require("dotenv").config()

// Use the same config as in database.js
const config = {
  user: process.env.DB_USER || "ga",
  password: process.env.DB_PASSWORD || "BUSONolsun_58@!#$",
  server: process.env.DB_SERVER || "localhost",
  database: "master", // Connect to master first to create our DB
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
}

async function setupDatabase() {
  console.log("Starting database setup...")
  console.log(
    "IMPORTANT: This script is disabled. Please use the SQL statements in database/manual_setup.sql to set up your database manually.",
  )
  console.log("Open SQL Server Management Studio, connect to your database, and run the SQL statements.")

  // Exit early since we're not doing automatic setup
  return
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log("Setup complete. Exiting...")
      process.exit(0)
    })
    .catch((err) => {
      console.error("Setup failed:", err)
      process.exit(1)
    })
}

module.exports = { setupDatabase }

