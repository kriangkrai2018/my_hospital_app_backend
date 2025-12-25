const pool = require('./config/config');

(async () => {
  try {
    const [rows] = await pool.promise().query('SELECT 1 + 1 AS result');
    console.log('DB test result:', rows);
    process.exit(0);
  } catch (err) {
    console.error('DB connection test failed:', err);
    process.exit(1);
  }
})();