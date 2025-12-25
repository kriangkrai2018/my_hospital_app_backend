// config/config.js
const mysql = require('mysql2');
require('dotenv').config();
const { URL } = require('url');

// Build dbConfig from DATABASE_URL (preferred) or from individual MYSQL_* env vars
let dbConfig = {};

if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    dbConfig = {
        host: u.hostname,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname ? u.pathname.slice(1) : '',
        port: u.port || 3306,
        charset: u.searchParams.get('charset') || process.env.MYSQL_CHARSET || 'utf8mb4'
    };

    // Optional SSL params from query string
    if (u.searchParams.get('ssl') === 'true') {
        dbConfig.ssl = {
            rejectUnauthorized: u.searchParams.get('rejectUnauthorized') !== 'false'
        };
    }
} else {
    dbConfig = {
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT || 3306,
        charset: process.env.MYSQL_CHARSET || 'utf8mb4'
    };

    if (process.env.MYSQL_SSL === 'true') {
        dbConfig.ssl = {
            // default: rejectUnauthorized=true for safety unless explicitly set to 'false'
            rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false'
        };
    }
}

// Basic validation - fail fast so missing config is obvious
const required = ['host', 'user', 'password', 'database'];
const missing = required.filter(k => !dbConfig[k]);
if (missing.length) {
    console.error('Missing DB config:', missing.join(', '));
    // throw new Error('Missing DB configuration: ' + missing.join(', '));
}

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.MYSQL_CONN_LIMIT || '10', 10),
    queueLimit: 0
});

module.exports = pool;