const sql = require('mssql');
require('dotenv').config();

const config = {
  user: "ga",
  password: "BUSONolsun_58@!#$",
  server: "localhost",
  database: "tutorial",

  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const pool = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL');
    return pool;
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    throw err;
  });

module.exports = {
  pool,
  sql
};