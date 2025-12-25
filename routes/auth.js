const express = require('express');
const router = express.Router();
const pool = require('../config/config');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('./verifyToken');
const { createNotification } = require('../utils/notifications');

const promisePool = pool.promise();

// (⭐⭐⭐ แก้ไข 1/2: เปลี่ยน Role เริ่มต้นกลับเป็น 'user' ⭐⭐⭐)
router.post('/register', async (req, res) => {
    const { username, password, department_id, fullname, position, phone } = req.body;
    
    if (!username || !password || !department_id || !fullname) {
        return res.status(400).json({ error: true, message: 'กรุณากรอกข้อมูล (ชื่อผู้ใช้, รหัสผ่าน, แผนก, ชื่อ-นามสกุล) ให้ครบ' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password_hash, department_id, role, is_approved, fullname, position, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    
    try {
        // [แก้ไข] เปลี่ยน 'nurse' กลับไปเป็น 'user'
        await promisePool.query(query, [username, hashedPassword, department_id, 'user', 1, fullname, position, phone]); // <-- แก้ไขตรงนี้
        
        await createNotification(`ผู้ใช้ใหม่ '${fullname}' (Username: ${username}) ได้ลงทะเบียนเป็น 'user'`, '/#user-management');
        
        res.status(201).json({ message: 'ลงทะเบียนสำเร็จ! บัญชีของคุณจะถูกตั้งเป็น "ผู้ใช้ทั่วไป" (User) ก่อน รอ Admin อนุมัติสิทธิ์' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: true, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
        }
        console.error('Registration error:', err);
        res.status(500).json({ error: true, message: 'เกิดข้อผิดพลาดในการลงทะเบียน' });
    }
});

// (⭐⭐⭐ แก้ไข 2/2: แก้ไข /user-profile ให้ดึง fullname, position, phone ⭐⭐⭐)
// (โค้ด /login ไม่เปลี่ยนแปลง)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: true, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }
    const query = 'SELECT user_id, username, password_hash, role, is_approved, department_id FROM users WHERE username = ?';
    try {
        const [rows] = await promisePool.query(query, [username]);
        if (rows.length === 0) {
            return res.status(401).json({ error: true, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: true, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        await promisePool.query('INSERT INTO user_logins (user_id) VALUES (?)', [user.user_id]);
        await promisePool.query('INSERT INTO activity_log (user_id, action_type) VALUES (?, ?)', [user.user_id, 'USER_LOGIN']);
        const tokenPayload = { 
            id: user.user_id, 
            username: user.username, 
            role: user.role,
            department_id: user.department_id
        };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, role: user.role, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: true, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
});

// Get user's own profile with department
router.get('/user-profile', verifyToken, async (req, res) => {
    const { id } = req.user;
    // (ดึง fullname, position, phone มาแสดงในโปรไฟล์ด้วย)
    const query = `
        SELECT u.username, d.name as department_name, u.fullname, u.position, u.phone 
        FROM users u 
        LEFT JOIN departments d ON u.department_id = d.id 
        WHERE u.user_id = ?
    `;
    try {
        const [rows] = await promisePool.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: true, message: 'ไม่พบผู้ใช้' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Get user profile error:', err);
        res.status(500).json({ error: true, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์' });
    }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
    const { id } = req.user;
    const { newUsername, newPassword, fullname, position, phone } = req.body;
    
    if (!newUsername && !newPassword && !fullname && !position && !phone) {
        return res.status(400).json({ error: true, message: 'ไม่มีข้อมูลสำหรับการอัปเดต' });
    }
    
    let query = 'UPDATE users SET ';
    const params = [];
    
    if (newUsername) {
        query += 'username = ?';
        params.push(newUsername);
    }
    if (newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        if (params.length > 0) query += ', ';
        query += 'password_hash = ?';
        params.push(hashedPassword);
    }
    if (fullname) {
        if (params.length > 0) query += ', ';
        query += 'fullname = ?';
        params.push(fullname);
    }
    if (position) {
        if (params.length > 0) query += ', ';
        query += 'position = ?';
        params.push(position);
    }
    if (phone) {
        if (params.length > 0) query += ', ';
        query += 'phone = ?';
        params.push(phone);
    }

    query += ' WHERE user_id = ?';
    params.push(id);
    
    try {
        await promisePool.query(query, params);
        res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: true, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
        }
        console.error('Update profile error:', err);
        res.status(500).json({ error: true, message: 'เกิดข้อผิดพลาดในการอัปเดต' });
    }
});

// Get list of departments for registration form
router.get('/departments', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT id, name FROM departments');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: true, message: 'ไม่สามารถดึงรายชื่อแผนกได้' });
    }
});

module.exports = router;