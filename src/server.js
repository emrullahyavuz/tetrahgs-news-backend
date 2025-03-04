const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { createProxyMiddleware} = require("http-proxy-middleware");
const connectMSSQL = require("./config/mssqlDbConfig");

const { startMssqlDBServis } = require("./services/MssqlDBServis");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());



app.use("/api/mssql", createProxyMiddleware({
    target: `http://localhost:${process.env.PORT_MSSQLDB || 5003}`,
    changeOrigin: true,
    logLevel: "debug",
    pathRewrite: {
        "^/api/mssql": "/api/mssql"
    }
}))

const startAllService = async () => {
    try {
       
      await connectMSSQL()
        await startMssqlDBServis(process.env.PORT_MSSQLDB || 5003)
    } catch (error) {
        console.error(error)
        process.exit(1)
    }
}

startAllService()

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});