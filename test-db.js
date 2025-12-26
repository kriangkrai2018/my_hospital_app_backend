// Simple test script to verify DB connection
const pool = require('./config/config');

(async () => {
  try {
    const [rows] = await pool.promise().query('SELECT 1+1 AS result');
    console.log('DB OK:', rows);
    process.exit(0);
  } catch (err) {
    console.error('DB connection error:', err.message || err);
    process.exit(1);
  }
})();
