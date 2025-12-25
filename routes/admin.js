const express = require('express');
const router = express.Router();
const pool = require('../config/config');
const { verifyToken, isAdmin } = require('./verifyToken');
const bcrypt = require('bcrypt');

const promisePool = pool.promise();

// =================================================================
// 1. ADMIN DASHBOARD (Overview)
// =================================================================
router.get('/dashboard', verifyToken, isAdmin, async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        // 1. KPI Stats
        const [calcToday] = await promisePool.query('SELECT COUNT(id) as count FROM formula_usage_log WHERE DATE(calculation_timestamp) = CURDATE()');
        const [calcMonth] = await promisePool.query('SELECT COUNT(id) as count FROM formula_usage_log WHERE MONTH(calculation_timestamp) = MONTH(CURDATE()) AND YEAR(calculation_timestamp) = YEAR(CURDATE())');
        const [usersTodayResult] = await promisePool.query('SELECT COUNT(DISTINCT user_id) as count FROM user_logins WHERE DATE(login_timestamp) = CURDATE()');
        
        // 2. Risk & Safety Stats
        const [highRiskUsage] = await promisePool.query(`
            SELECT COUNT(ul.id) as count 
            FROM formula_usage_log ul 
            JOIN formulas f ON ul.formula_id = f.id 
            WHERE (f.name LIKE '%Levophed%' OR f.name LIKE '%Dopamine%' OR f.name LIKE '%TNK%' OR f.name LIKE '%Adrenaline%') 
            AND DATE(ul.calculation_timestamp) = CURDATE()
        `);

        // 3. Graphs Data
        const [usageInRangeResult] = await promisePool.query('SELECT DATE(calculation_timestamp) as calc_date, COUNT(id) as count FROM formula_usage_log WHERE DATE(calculation_timestamp) BETWEEN ? AND ? GROUP BY calc_date ORDER BY calc_date', [startDate, endDate]);
        const [newPatientsByDayResult] = await promisePool.query('SELECT DATE(created_at) as reg_date, COUNT(id) as count FROM patients WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY reg_date ORDER BY reg_date', [startDate, endDate]);
        const [departmentUsage] = await promisePool.query('SELECT d.name AS department_name, COUNT(u.user_id) AS usage_count FROM users u JOIN departments d ON u.department_id = d.id GROUP BY d.name ORDER BY usage_count DESC');

        // 4. Insights
        const [topFormulasResult] = await promisePool.query(`
            SELECT f.name, COUNT(*) as usage_count FROM formula_usage_log l
            JOIN formulas f ON l.formula_id = f.id
            GROUP BY l.formula_id, f.name ORDER BY usage_count DESC LIMIT 5
        `);
        const [recentActivity] = await promisePool.query('SELECT u.username, al.action_type, al.details, al.timestamp FROM activity_log al JOIN users u ON al.user_id = u.user_id ORDER BY al.timestamp DESC LIMIT 5');

        // Process Graph Data
        const processDateData = (rows, dateField) => {
            const map = new Map(rows.map(row => [new Date(row[dateField]).toISOString().split('T')[0], row.count]));
            const labels = []; const dataPoints = [];
            let currentDate = new Date(startDate); let end = new Date(endDate);
            while (currentDate <= end) {
                const dateString = currentDate.toISOString().split('T')[0];
                labels.push(dateString); dataPoints.push(map.get(dateString) || 0);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            return { labels, dataPoints };
        };
        
        res.json({
            calcToday: calcToday[0].count,
            calcMonth: calcMonth[0].count,
            usersToday: usersTodayResult[0].count,
            highRiskToday: highRiskUsage[0].count,
            departmentUsage,
            usageInRange: processDateData(usageInRangeResult, 'calc_date'),
            newPatientsInRange: processDateData(newPatientsByDayResult, 'reg_date'),
            topFormulas: topFormulasResult,
            recentActivity
        });

    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({ error: true, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Dashboard' });
    }
});

// =================================================================
// 2. USER MANAGEMENT
// =================================================================
router.get('/users', verifyToken, isAdmin, async (req, res) => {
    try {
        const [users] = await promisePool.query(`
            SELECT u.user_id, u.username, u.role, u.is_approved, u.department_id, u.created_at,
                d.name AS department_name, u.fullname, u.position, u.phone,
                (SELECT MAX(login_timestamp) FROM user_logins WHERE user_id = u.user_id) AS last_login
            FROM users u LEFT JOIN departments d ON u.department_id = d.id ORDER BY u.created_at DESC
        `);
        res.json(users);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch users' }); }
});

router.put('/users/status/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params; const { is_approved } = req.body;
    if (req.user.id == id) return res.status(403).json({ message: 'ไม่สามารถระงับบัญชีตัวเองได้' });
    try {
        await promisePool.query('UPDATE users SET is_approved = ? WHERE user_id = ?', [is_approved ? 1 : 0, id]);
        await promisePool.query('INSERT INTO activity_log (user_id, action_type, details) VALUES (?, ?, ?)', [req.user.id, is_approved ? 'UNSUSPEND_USER' : 'SUSPEND_USER', `User ID: ${id} status: ${is_approved}`]);
        res.json({ message: 'อัปเดตสถานะสำเร็จ' });
    } catch (err) { res.status(500).json({ message: 'Error updating status' }); }
});

router.get('/users/activity/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [activities] = await promisePool.query('SELECT action_type, details, timestamp FROM activity_log WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20', [req.params.id]);
        const [stats] = await promisePool.query('SELECT (SELECT COUNT(*) FROM formula_usage_log WHERE user_id = ?) as calc_count, (SELECT COUNT(*) FROM dispensing_history WHERE doctor_id = ?) as dispense_count', [req.params.id, req.params.id]);
        res.json({ activities, stats: stats[0] });
    } catch (err) { res.status(500).json({ message: 'Error fetching activity' }); }
});

router.put('/users/role/:id', verifyToken, isAdmin, async (req, res) => {
    if (req.user.id == req.params.id) return res.status(403).json({ message: 'เปลี่ยนบทบาทตัวเองไม่ได้' });
    try {
        await promisePool.query('UPDATE users SET role = ? WHERE user_id = ?', [req.body.newRole, req.params.id]);
        await promisePool.query('INSERT INTO activity_log (user_id, action_type, details) VALUES (?, ?, ?)', [req.user.id, 'CHANGE_ROLE', `User ID ${req.params.id} to ${req.body.newRole}`]);
        res.json({ message: 'อัปเดตบทบาทสำเร็จ' });
    } catch (err) { res.status(500).json({ message: 'Error updating role' }); }
});

router.delete('/users/delete/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await promisePool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
        await promisePool.query('INSERT INTO activity_log (user_id, action_type, details) VALUES (?, ?, ?)', [req.user.id, 'DELETE_USER', `Deleted User ID ${req.params.id}`]);
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (err) { res.status(500).json({ message: 'Error deleting user' }); }
});

// =================================================================
// 3. PATIENT MANAGEMENT (Medical Update)
// =================================================================
router.get('/patients', verifyToken, isAdmin, async (req, res) => {
    try {
        // ดึงข้อมูล Clinical เพิ่มเติม (Weight, Height, Allergies, Status)
        const [patients] = await promisePool.query(`
            SELECT id, hn, fullname, gender, dob, phone, location, 
                   status, weight, height, allergies
            FROM patients 
            ORDER BY 
                CASE WHEN status = 'ICU' THEN 1 WHEN status = 'IPD' THEN 2 ELSE 3 END, 
                fullname ASC
        `);
        res.json(patients);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch patients' }); }
});

router.get('/patients/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await promisePool.query("SELECT * FROM patients WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Patient not found' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ message: 'Error fetching patient' }); }
});

router.put('/patients/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { hn, fullname, dob, gender, national_id, address, phone, insurance_type, emergency_contact_name, emergency_contact_phone, weight, height, allergies, status } = req.body;
    if (!hn || !fullname) return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });

    try {
        const query = `
            UPDATE patients SET 
                hn=?, fullname=?, dob=?, gender=?, national_id=?, address=?, phone=?, 
                insurance_type=?, emergency_contact_name=?, emergency_contact_phone=?,
                weight=?, height=?, allergies=?, status=?
            WHERE id=?
        `;
        const params = [hn, fullname, dob || null, gender, national_id, address, phone, insurance_type, emergency_contact_name, emergency_contact_phone, weight || null, height || null, allergies || '', status || 'OPD', id];
        await promisePool.query(query, params);
        res.json({ message: 'บันทึกข้อมูลสำเร็จ' });
    } catch (error) { res.status(500).json({ message: 'Error updating patient' }); }
});

// ดึงประวัติการจ่ายยา/คำนวณ (Medical History)
router.get('/patients/calc-history/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [history] = await promisePool.query(`
            SELECT dh.drug_name, dh.dosage, dh.dispensed_at, u.username as doctor_name, f.name as formula_name
            FROM dispensing_history dh
            LEFT JOIN users u ON dh.doctor_id = u.user_id
            LEFT JOIN formulas f ON dh.formula_id = f.id
            WHERE dh.patient_id = ?
            ORDER BY dh.dispensed_at DESC LIMIT 20
        `, [req.params.id]);
        res.json(history);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch history' }); }
});

router.get('/patients/history/:id', verifyToken, isAdmin, async (req, res) => {
    // (เหมือน calc-history แต่เอาไว้เผื่อ frontend เก่าเรียกใช้)
    try {
        const [history] = await promisePool.query(`SELECT dh.drug_name, dh.dosage, dh.dispensed_at, u.username AS doctor_name, f.name AS formula_name FROM dispensing_history dh JOIN users u ON dh.doctor_id = u.user_id LEFT JOIN formulas f ON dh.formula_id = f.id WHERE dh.patient_id = ? ORDER BY dh.dispensed_at DESC`, [req.params.id]);
        res.json(history);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch history' }); }
});

// =================================================================
// 4. FORMULA MANAGEMENT
// =================================================================
router.get('/formulas', verifyToken, isAdmin, async (req, res) => {
    try {
        const [formulas] = await promisePool.query(`SELECT f.id, f.name, f.visibility, u.username as creator_name FROM formulas f LEFT JOIN users u ON f.created_by = u.user_id ORDER BY f.visibility, f.name`);
        res.json(formulas);
    } catch (err) { res.status(500).json({ message: 'Failed to fetch formulas' }); }
});

router.get('/formulas/builder-data/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [formulas] = await promisePool.query('SELECT * FROM formulas WHERE id = ?', [req.params.id]);
        if (formulas.length === 0) return res.status(404).json({ message: 'Formula not found' });
        const formulaData = formulas[0];
        const [inputs] = await promisePool.query('SELECT variable_name, display_name, unit, logic_type FROM formula_inputs WHERE formula_id = ?', [req.params.id]);
        const [doseLogic] = await promisePool.query("SELECT logic_definition FROM formula_logic WHERE formula_id = ? AND type = 'dose'", [req.params.id]);
        const [rateLogic] = await promisePool.query("SELECT logic_definition FROM formula_logic WHERE formula_id = ? AND type = 'rate'", [req.params.id]);
        
        res.json({
            name: formulaData.name, description: formulaData.description, result_unit: formulaData.result_unit, visibility: formulaData.visibility,
            calculation_data: {
                variables: inputs.map(i => ({ id: i.variable_name, name: i.display_name, unit: i.unit })),
                doseLogic: doseLogic.length > 0 ? JSON.parse(doseLogic[0].logic_definition) : [],
                rateLogic: rateLogic.length > 0 ? JSON.parse(rateLogic[0].logic_definition) : [],
            }
        });
    } catch (err) { res.status(500).json({ message: 'Failed to fetch formula data' }); }
});

router.delete('/formulas/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await promisePool.query('DELETE FROM formulas WHERE id = ?', [req.params.id]);
        res.json({ message: 'ลบสูตรยาสำเร็จ' });
    } catch (err) { res.status(500).json({ message: 'Failed to delete formula' }); }
});

// =================================================================
// 5. MED RECORDS, LISTS, DEPARTMENTS, SETTINGS
// =================================================================
router.get('/history/dispensing', verifyToken, isAdmin, async (req, res) => {
    try {
        const { patientId, doctorId, departmentId } = req.query;
        let query = `SELECT p.fullname as patient_name, dh.drug_name, dh.dosage, u.username as doctor_name, d.name as department_name, dh.dispensed_at as timestamp FROM dispensing_history dh JOIN users u ON dh.doctor_id = u.user_id LEFT JOIN patients p ON dh.patient_id = p.id LEFT JOIN departments d ON u.department_id = d.id WHERE 1=1`;
        const params = [];
        if (patientId) { query += ' AND dh.patient_id = ?'; params.push(patientId); }
        if (doctorId) { query += ' AND dh.doctor_id = ?'; params.push(doctorId); }
        if (departmentId) { query += ' AND u.department_id = ?'; params.push(departmentId); }
        query += ' ORDER BY dh.dispensed_at DESC LIMIT 100';
        const [history] = await promisePool.query(query, params);
        res.json(history);
    } catch (err) { res.status(500).json({ message: 'Error fetching history' }); }
});

router.get('/list/patients', verifyToken, isAdmin, async (req, res) => {
    try { const [rows] = await promisePool.query('SELECT id, hn, fullname FROM patients ORDER BY fullname ASC'); res.json(rows); } catch (err) { res.status(500).json({ message: 'Error' }); }
});
router.get('/list/doctors', verifyToken, isAdmin, async (req, res) => {
    try { const [rows] = await promisePool.query("SELECT user_id, username FROM users WHERE role IN ('doctor', 'admin')"); res.json(rows); } catch (err) { res.status(500).json({ message: 'Error' }); }
});

router.get('/departments', verifyToken, isAdmin, async (req, res) => {
    try { const [rows] = await promisePool.query(`SELECT d.id, d.name, COUNT(u.user_id) AS user_count FROM departments d LEFT JOIN users u ON d.id = u.department_id GROUP BY d.id, d.name ORDER BY d.name ASC`); res.json(rows); } catch (err) { res.status(500).json({ message: 'Error' }); }
});
router.post('/departments', verifyToken, isAdmin, async (req, res) => {
    try { await promisePool.query('INSERT INTO departments (name) VALUES (?)', [req.body.name]); res.status(201).json({ message: 'Created' }); } catch (err) { res.status(500).json({ message: 'Error' }); }
});
router.put('/departments/:id', verifyToken, isAdmin, async (req, res) => {
    try { await promisePool.query('UPDATE departments SET name = ? WHERE id = ?', [req.body.name, req.params.id]); res.json({ message: 'Updated' }); } catch (err) { res.status(500).json({ message: 'Error' }); }
});
router.delete('/departments/:id', verifyToken, isAdmin, async (req, res) => {
    try { await promisePool.query('DELETE FROM departments WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ message: 'Error' }); }
});
router.get('/departments/:id/users', verifyToken, isAdmin, async (req, res) => {
    try { const [rows] = await promisePool.query('SELECT username, role FROM users WHERE department_id = ?', [req.params.id]); res.json(rows); } catch (err) { res.status(500).json({ message: 'Error' }); }
});

router.get('/settings', verifyToken, isAdmin, async (req, res) => {
    try { const [rows] = await promisePool.query('SELECT * FROM system_settings'); res.json(rows.reduce((obj, item) => { obj[item.setting_key] = item.setting_value; return obj; }, {})); } catch (err) { res.status(500).json({ message: 'Error' }); }
});
router.put('/settings', verifyToken, isAdmin, async (req, res) => {
    try {
        for (const key in req.body) { await promisePool.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, req.body[key], req.body[key]]); }
        res.json({ message: 'Saved' });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

module.exports = router;