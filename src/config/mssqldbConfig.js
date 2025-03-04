const sql = require("mssql");
require("dotenv").config();

const mssqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.PORT_MSSQL, 10) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
};
1
const connectMSSQL = async () => {
    try {
        const connection = await sql.connect(mssqlConfig);
        console.log("MSSQL Bağlantısı Başarılı..");
        return connection;
    } catch (error) {
        console.error("MSSQL Bağlantısı Başarısız:", error.message);
    }
};

module.exports = connectMSSQL;