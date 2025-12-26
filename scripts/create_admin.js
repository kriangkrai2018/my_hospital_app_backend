const pool = require('../config/config');
const bcrypt = require('bcrypt');

(async () => {
  try {
    const promisePool = pool.promise();
    const username = 'admin';
    const password = 'admin';
    const [rows] = await promisePool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
      console.log('Admin user already exists');
      process.exit(0);
    }
    const hash = await bcrypt.hash(password, 10);
    // Create a default department if none exists
    const [deps] = await promisePool.query('SELECT id FROM departments LIMIT 1');
    let deptId = null;
    if (deps.length === 0) {
      const [r] = await promisePool.query('INSERT INTO departments (name) VALUES (?)', ['Default']);
      deptId = r.insertId;
    } else {
      deptId = deps[0].id;
    }

    await promisePool.query('INSERT INTO users (username, password_hash, department_id, role, is_approved, fullname) VALUES (?, ?, ?, ?, ?, ?)', [username, hash, deptId, 'admin', 1, 'Administrator']);
    console.log('Admin user created: username=admin password=admin');
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exit(1);
  }
})();
