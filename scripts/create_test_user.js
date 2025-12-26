const bcrypt = require('bcrypt');
const pool = require('../config/config');

async function createTestUser() {
  const promisePool = pool.promise();
  const username = 'testuser';
  const password = 'testpass';
  const department_id = 1; // Default
  const fullname = 'Test User';
  const position = 'Tester';
  const phone = '0000000000';
  try {
    const [rows] = await promisePool.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
      console.log('User already exists, skipping creation');
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const insertQuery = 'INSERT INTO users (username, password_hash, department_id, role, is_approved, fullname, position, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const [result] = await promisePool.query(insertQuery, [username, hashed, department_id, 'user', 1, fullname, position, phone]);
    console.log('Created test user:', { username, user_id: result.insertId });
  } catch (err) {
    console.error('Error creating test user:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

createTestUser();
