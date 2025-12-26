// ในไฟล์ config.js
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: process.env.MYSQL_CHARSET,
    port: process.env.MYSQL_PORT, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;