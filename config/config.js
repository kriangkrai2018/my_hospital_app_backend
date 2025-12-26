// ในไฟล์ config.js
const mysql = require('mysql2');
const fs = require('fs');
require('dotenv').config();

// Build pool configuration with sensible defaults
const poolConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: process.env.MYSQL_CHARSET || 'utf8mb4',
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// If an SSL CA path is provided, try to load it (needed for TiDB TLS connections)
if (process.env.MYSQL_SSL_CA) {
    try {
        poolConfig.ssl = {
            ca: fs.readFileSync(process.env.MYSQL_SSL_CA)
        };
    } catch (err) {
        // Don't throw — warn so the server can still start and you can see the issue
        console.warn('Warning: could not read MYSQL_SSL_CA:', process.env.MYSQL_SSL_CA, err.message);
    }
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;