const bcrypt = require('bcrypt');
const pool = require('../config/config');

async function setAdminPassword(newPassword) {
  const promisePool = pool.promise();
  try {
    const [admins] = await promisePool.query("SELECT user_id, username, role FROM users WHERE username = 'admin' OR role = 'admin'");
    if (!admins || admins.length === 0) {
      console.log('No admin users found (username="admin" or role="admin").');
      process.exit(0);
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const updated = [];
    for (const u of admins) {
      await promisePool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashed, u.user_id]);
      updated.push(u.username || `id:${u.user_id}`);
    }

    console.log('Updated password for admin accounts:', updated.join(', '));
  } catch (err) {
    console.error('Error updating admin password:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

const newPass = process.argv[2] || '1234';
setAdminPassword(newPass);
