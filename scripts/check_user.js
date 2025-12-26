const pool = require('../config/config');
(async () => {
  try {
    const promisePool = pool.promise();
    const [rows] = await promisePool.query('SELECT user_id, username, password_hash, role, is_approved FROM users WHERE username = ?', ['testuser']);
    console.log('rows:', rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
})();
