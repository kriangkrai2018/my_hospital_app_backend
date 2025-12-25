// db.js — Compatibility wrapper that re-uses pool from config
// Avoid hardcoding credentials here; use env vars or DATABASE_URL
const pool = require('./config/config');

// Quick connectivity check (non-fatal)
pool.promise().getConnection()
  .then(conn => {
    conn.release();
    console.log(`Connected to database: ${process.env.MYSQL_DATABASE || '(unknown)'}`);
  })
  .catch(err => {
    console.error('Warning: could not establish DB connection on startup:', err.message);
  });

module.exports = pool;