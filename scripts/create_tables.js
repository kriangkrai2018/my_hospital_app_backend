const pool = require('../config/config');
const promisePool = pool.promise();

(async () => {
  try {
    console.log('Creating tables...');
    await promisePool.query(`CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      department_id INT DEFAULT NULL,
      role VARCHAR(50) DEFAULT 'user',
      is_approved TINYINT(1) DEFAULT 1,
      fullname VARCHAR(255) DEFAULT NULL,
      position VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS user_logins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      login_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action_type VARCHAR(100) NOT NULL,
      details TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS formulas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      result_unit VARCHAR(100),
      decimal_places INT DEFAULT NULL,
      icon_class VARCHAR(255) DEFAULT NULL,
      visibility VARCHAR(50) DEFAULT 'public',
      created_by INT DEFAULT NULL,
      FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS formula_inputs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formula_id INT NOT NULL,
      variable_name VARCHAR(150) NOT NULL,
      display_name VARCHAR(255) DEFAULT NULL,
      unit VARCHAR(50) DEFAULT NULL,
      logic_type VARCHAR(20) DEFAULT 'dose',
      FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS formula_logic (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formula_id INT NOT NULL,
      logic_definition JSON,
      type VARCHAR(20) DEFAULT 'dose',
      FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS formula_usage_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formula_id INT DEFAULT NULL,
      user_id INT DEFAULT NULL,
      calculation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS patients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hn VARCHAR(50) NOT NULL,
      fullname VARCHAR(255) NOT NULL,
      gender VARCHAR(10) DEFAULT NULL,
      dob DATE DEFAULT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      location VARCHAR(255) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'OPD',
      weight DECIMAL(8,2) DEFAULT NULL,
      height DECIMAL(8,2) DEFAULT NULL,
      allergies TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS dispensing_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT DEFAULT NULL,
      doctor_id INT DEFAULT NULL,
      drug_name VARCHAR(255) DEFAULT NULL,
      dosage VARCHAR(255) DEFAULT NULL,
      formula_id INT DEFAULT NULL,
      dispensed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES users(user_id) ON DELETE SET NULL,
      FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(255) UNIQUE,
      setting_value TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await promisePool.query(`CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL,
      message TEXT,
      link VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    console.log('Tables created/verified successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  }
})();
