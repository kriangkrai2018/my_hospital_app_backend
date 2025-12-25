const express = require("express");
const router = express.Router();
const pool = require('../config/config');
// (⭐⭐⭐ แก้ไข 1/4: Import isAnyAuthenticatedUser กลับมา ⭐⭐⭐)
const { verifyToken, isAdminOrDoctor, isAnyAuthenticatedUser, isDoctorNurseOrAdmin, isNurseOrAdmin } = require('./verifyToken');
const { evaluate } = require('../utils/formula_evaluator');
const { createNotification } = require('../utils/notifications');
const promisePool = pool.promise();

// ========== FORMULA LISTING & CREATION ==========

// (⭐⭐⭐ แก้ไข 2/4: เปลี่ยน Middleware กลับเป็น isAnyAuthenticatedUser ⭐⭐⭐)
router.get('/formulas', verifyToken, isAnyAuthenticatedUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const userDeptId = req.user.department_id; 

        const formulasQuery = `
            SELECT DISTINCT
                f.id, f.name, f.description, f.visibility, f.result_unit, f.icon_class,
                u_creator.username AS creator_name,
                d.name AS department_name,
                (IFNULL(dispense_counts.count, 0) + IFNULL(calc_counts.count, 0)) AS usage_count
            FROM
                formulas f
            LEFT JOIN
                users u_creator ON f.created_by = u_creator.user_id
            LEFT JOIN
                departments d ON u_creator.department_id = d.id
            LEFT JOIN
                (SELECT formula_id, COUNT(id) as count FROM dispensing_history GROUP BY formula_id) AS dispense_counts ON f.id = dispense_counts.formula_id
            LEFT JOIN
                (SELECT formula_id, COUNT(id) as count FROM formula_usage_log GROUP BY formula_id) AS calc_counts ON f.id = calc_counts.formula_id
            LEFT JOIN
                formula_user_permissions fup ON f.id = fup.formula_id

            WHERE
                f.visibility = 'public'
                ${(userRole === 'doctor' || userRole === 'admin') ? 'OR f.created_by = ?' : ''}
                OR fup.user_id = ?
            
            ORDER BY
                CASE 
                    WHEN f.created_by = ? THEN 0
                    WHEN f.visibility = 'private' THEN 1
                    ELSE 2
                END,
                usage_count DESC,
                f.name ASC;
        `;
        
        // (เราต้องปรับ queryParams ให้รองรับ 'user' role ที่ไม่มีสิทธิ์ f.created_by)
        const queryParams = (userRole === 'doctor' || userRole === 'admin')
            ? [userId, userId, userId]
            : [userId, userId]; // สำหรับ 'user' และ 'nurse'

        const [formulasRows] = await promisePool.query(formulasQuery, queryParams);

        if (formulasRows.length === 0) return res.json([]);

        const formulaIds = formulasRows.map(f => f.id);
        const formulasMap = new Map(formulasRows.map(f => [f.id, { ...f, inputs: [], rate_inputs: [] }]));
        const inputsQuery = `SELECT formula_id, variable_name, display_name, unit, logic_type FROM formula_inputs WHERE formula_id IN (?)`;

        if (formulaIds.length > 0) {
            const [inputsRows] = await promisePool.query(inputsQuery, [formulaIds]);
            for (const input of inputsRows) {
                const formula = formulasMap.get(input.formula_id);
                if (formula) {
                    const inputData = { variable_name: input.variable_name, display_name: input.display_name, unit: input.unit };
                    if (input.logic_type === 'rate') formula.rate_inputs.push(inputData);
                    else formula.inputs.push(inputData);
                }
            }
        }
        res.status(200).json(Array.from(formulasMap.values()));
    } catch (err) {
        console.error("Error fetching and sorting formulas:", err);
        res.status(500).json({ error: true, message: "Failed to fetch formulas." });
    }
});

router.post('/formulas', verifyToken, isAdminOrDoctor, async (req, res) => {
    const { name, description, result_unit, visibility, calculation_data } = req.body; 
    const { variables, doseLogic, rateLogic } = calculation_data;
    const userId = req.user.id; 
    if (!name || !calculation_data) return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const [formulaResult] = await connection.query( 'INSERT INTO formulas (name, description, result_unit, visibility, created_by) VALUES (?, ?, ?, ?, ?)', [name, description, result_unit, visibility, userId] );
        const newFormulaId = formulaResult.insertId;
        if (variables && variables.length > 0) {
            const variableValues = [...new Set(variables.flatMap(v => {
                const types = [];
                if (JSON.stringify(doseLogic).includes(v.id)) types.push('dose');
                if (JSON.stringify(rateLogic).includes(v.id)) types.push('rate');
                return types.map(type => [newFormulaId, v.id, v.name, v.unit, type]);
            }).map(JSON.stringify))].map(JSON.parse);
            if(variableValues.length > 0) {
                await connection.query('INSERT INTO formula_inputs (formula_id, variable_name, display_name, unit, logic_type) VALUES ?', [variableValues]);
            }
        }
        if (doseLogic && doseLogic.length > 0) await connection.query('INSERT INTO formula_logic (formula_id, logic_definition, type) VALUES (?, ?, ?)', [newFormulaId, JSON.stringify(doseLogic), 'dose']);
        if (rateLogic && rateLogic.length > 0) await connection.query('INSERT INTO formula_logic (formula_id, logic_definition, type) VALUES (?, ?, ?)', [newFormulaId, JSON.stringify(rateLogic), 'rate']);

        if (visibility === 'private') {
            await connection.query('INSERT INTO formula_user_permissions (formula_id, user_id) VALUES (?, ?)', [newFormulaId, userId]);
        }
        
        await connection.commit();
        await createNotification(`ผู้ใช้ '${req.user.username}' ได้สร้างสูตรยาใหม่: ${name}`, '/#formula-management');
        const logDetails = `สร้างสูตร: ${name}`;
        await promisePool.query('INSERT INTO activity_log (user_id, action_type, details) VALUES (?, ?, ?)', [userId, 'FORMULA_CREATE', logDetails]);
        res.status(201).json({ message: 'บันทึกสูตรยาสำเร็จ!', formulaId: newFormulaId });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating new formula:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกสูตรยา' });
    } finally {
        connection.release();
    }
});

router.put('/formulas/share/:id', verifyToken, isAdminOrDoctor, async (req, res) => {
    const formulaId = req.params.id;
    const ownerUserId = req.user.id; 
    const { userIds } = req.body; 
    if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ message: 'กรุณาส่งรายชื่อผู้ใช้ที่ต้องการแชร์' });
    }
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const [formulas] = await connection.query('SELECT created_by FROM formulas WHERE id = ?', [formulaId]);
        if (formulas.length === 0 || formulas[0].created_by !== ownerUserId) {
            await connection.rollback();
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์แชร์สูตรยานี้' });
        }
        await connection.query('DELETE FROM formula_user_permissions WHERE formula_id = ? AND user_id != ?', [formulaId, ownerUserId]);
        const userIdsToInsert = userIds.filter(id => id !== ownerUserId); 
        if (userIdsToInsert.length > 0) {
            const insertValues = userIdsToInsert.map(userId => [formulaId, userId]);
            await connection.query('INSERT INTO formula_user_permissions (formula_id, user_id) VALUES ? ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)', [insertValues]);
        }
        const currentUserIdsWithPermission = (await connection.query('SELECT user_id FROM formula_user_permissions WHERE formula_id = ?', [formulaId]))[0].map(row => row.user_id);
        const userIdsToRemove = currentUserIdsWithPermission.filter(id => id !== ownerUserId && !userIds.includes(id));
        if(userIdsToRemove.length > 0) {
             await connection.query('DELETE FROM formula_user_permissions WHERE formula_id = ? AND user_id IN (?)', [formulaId, userIdsToRemove]);
        }
        await connection.commit();
        res.json({ message: 'อัปเดตการแชร์สูตรยาสำเร็จ' });
    } catch (error) {
        await connection.rollback();
        console.error('Error sharing formula:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแชร์สูตรยา' });
    } finally {
        connection.release();
    }
});

router.get('/department/nurses', verifyToken, isAdminOrDoctor, async (req, res) => {
    try {
        const userDeptId = req.user.department_id;
        if (!userDeptId) { return res.status(400).json({ message: 'ไม่พบข้อมูลแผนกของผู้ใช้' }); }
        const [nurses] = await promisePool.query("SELECT user_id, username FROM users WHERE department_id = ? AND role = 'nurse' ORDER BY username ASC", [userDeptId]);
        res.json(nurses);
    } catch (error) {
        console.error('Error fetching nurses in department:', error);
        res.status(500).json({ message: 'Failed to fetch nurse list' });
    }
});

router.get('/formulas/permissions/:id', verifyToken, isAdminOrDoctor, async (req, res) => {
    const formulaId = req.params.id;
    const ownerUserId = req.user.id;
    try {
        const [formulas] = await promisePool.query('SELECT created_by FROM formulas WHERE id = ?', [formulaId]);
        if (formulas.length === 0 || formulas[0].created_by !== ownerUserId) {
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดูข้อมูลนี้' });
        }
        const [permissions] = await promisePool.query( 'SELECT user_id FROM formula_user_permissions WHERE formula_id = ?', [formulaId] );
        res.json({ sharedUserIds: permissions.map(p => p.user_id) });
    } catch (error) {
        console.error('Error fetching formula user permissions:', error);
        res.status(500).json({ message: 'Failed to fetch formula permissions' });
    }
});

router.delete('/formulas/:id', verifyToken, isAdminOrDoctor, async (req, res) => {
    const formulaId = req.params.id;
    const userId = req.user.id;
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const [formulas] = await connection.query('SELECT created_by FROM formulas WHERE id = ?', [formulaId]);
        if (formulas.length === 0 || formulas[0].created_by !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ลบสูตรยานี้' });
        }
        await connection.query('DELETE FROM formula_inputs WHERE formula_id = ?', [formulaId]);
        await connection.query('DELETE FROM formula_logic WHERE formula_id = ?', [formulaId]);
        await connection.query('DELETE FROM formulas WHERE id = ?', [formulaId]); 
        await connection.commit();
        res.json({ message: 'ลบสูตรยาสำเร็จ' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting formula:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบสูตรยา' });
    } finally {
        connection.release();
    }
});

// ========== CALCULATION & LOGGING ==========
// (⭐⭐⭐ แก้ไข 3/4: เปลี่ยน Middleware กลับเป็น isAnyAuthenticatedUser ⭐⭐⭐)
router.post('/calculate-formula', verifyToken, isAnyAuthenticatedUser, async (req, res) => {
    const { formulaId, inputs } = req.body;
    if (!formulaId || !inputs) return res.status(400).json({ error: true, message: "ข้อมูลสำหรับคำนวณไม่ครบถ้วน" });
    try {
        const logicQuery = `SELECT f.result_unit, f.decimal_places, fl.logic_definition FROM formulas f LEFT JOIN formula_logic fl ON f.id = fl.formula_id WHERE f.id = ? AND fl.type = 'dose'`;
        const [rows] = await promisePool.query(logicQuery, [formulaId]);
        if (rows.length === 0 || !rows[0].logic_definition) return res.status(404).json({ error: true, message: "ไม่พบ Logic การคำนวณสำหรับสูตรนี้" });
        const formulaInfo = rows[0];
        const logicDefinition = JSON.parse(formulaInfo.logic_definition);
        const result = evaluate(logicDefinition, inputs, formulaInfo.decimal_places);
        res.json({ result: result, unit: formulaInfo.result_unit });
    } catch (err) {
        console.error("Formula calculation error:", err);
        res.status(500).json({ error: true, message: "เกิดข้อผิดพลาดในเซิร์ฟเวอร์ขณะคำนวณ" });
    }
});

// (⭐⭐⭐ แก้ไข 4/4: เปลี่ยน Middleware กลับเป็น isAnyAuthenticatedUser ⭐⭐⭐)
router.post('/calculate-rate', verifyToken, isAnyAuthenticatedUser, async (req, res) => {
    const { formulaId, inputs } = req.body;
    if (!formulaId || !inputs) return res.status(400).json({ error: true, message: "ข้อมูลสำหรับคำนวณไม่ครบถ้วน" });
    try {
        const logicQuery = `SELECT f.result_unit, f.decimal_places, fl.logic_definition FROM formulas f LEFT JOIN formula_logic fl ON f.id = fl.formula_id WHERE f.id = ? AND fl.type = 'rate'`;
        const [rows] = await promisePool.query(logicQuery, [formulaId]);
        if (rows.length === 0 || !rows[0].logic_definition) return res.status(404).json({ error: true, message: "ไม่พบ Logic การคำนวณ Rate" });
        const formulaInfo = rows[0];
        const logicDefinition = JSON.parse(formulaInfo.logic_definition);
        const result = evaluate(logicDefinition, inputs, 2);
        res.json({ rate: result, unit: 'ml/hr' });
    } catch (err) {
        console.error("Rate calculation error:", err);
        res.status(500).json({ error: true, message: "เกิดข้อผิดพลาดขณะคำนวณ Rate" });
    }
});

router.post('/log-calculation', verifyToken, isAnyAuthenticatedUser, async (req, res) => {
    const { formulaId } = req.body;
    const userId = req.user.id;
    if (!formulaId) return res.status(400).json({ message: 'Formula ID is required.' });
    try {
        await promisePool.query("INSERT INTO formula_usage_log (formula_id, user_id) VALUES (?, ?)", [formulaId, userId]);
        res.status(200).json({ message: 'Usage logged.' });
    } catch (error) {
        console.error('Error logging formula usage:', error);
        res.status(500).json({ message: 'Failed to log usage.' });
    }
});

// ========== PATIENT HANDLING ==========
router.post('/patient', verifyToken, isNurseOrAdmin, async (req, res) => {
    const { hn, fullname, dob, gender, national_id, address, phone, insurance_type, emergency_contact_name, emergency_contact_phone } = req.body;
    if (!hn || !fullname) return res.status(400).json({ message: 'กรุณากรอก HN และ ชื่อ-นามสกุล' });
    try {
        const query = `
            INSERT INTO patients (hn, fullname, dob, gender, national_id, address, phone, insurance_type, emergency_contact_name, emergency_contact_phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                fullname=VALUES(fullname), dob=VALUES(dob), gender=VALUES(gender), national_id=VALUES(national_id), address=VALUES(address),
                phone=VALUES(phone), insurance_type=VALUES(insurance_type), emergency_contact_name=VALUES(emergency_contact_name),
                emergency_contact_phone=VALUES(emergency_contact_phone);
        `;
        const params = [hn, fullname, dob || null, gender, national_id, address, phone, insurance_type, emergency_contact_name, emergency_contact_phone];
        await promisePool.query(query, params);
        res.status(201).json({ message: 'บันทึกข้อมูลผู้ป่วยสำเร็จ' });
    } catch (error) {
        console.error('Error saving patient data:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ป่วย' });
    }
});

router.get('/patients/:hn', verifyToken, isNurseOrAdmin, async (req, res) => {
    const { hn } = req.params;
    try {
        const [rows] = await promisePool.query("SELECT id, fullname FROM patients WHERE hn = ?", [hn]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: 'Patient not found' });
    } catch (error) {
        console.error('Error fetching patient by HN:', error);
        res.status(500).json({ message: 'Failed to fetch patient data' });
    }
});

// ========== DRUG DISPENSING ==========
router.post('/dispense', verifyToken, isNurseOrAdmin, async (req, res) => {
    const { patientHn, drugName, dosage, formulaId } = req.body;
    const userId = req.user.id;
    if (!patientHn || !drugName || !dosage) return res.status(400).json({ message: 'กรุณากรอกข้อมูลการจ่ายยาให้ครบถ้วน' });
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        const [patients] = await connection.query('SELECT id FROM patients WHERE hn = ?', [patientHn]);
        if (patients.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'ไม่พบผู้ป่วย HN นี้ในระบบ' });
        }
        const patientId = patients[0].id;
        await connection.query('INSERT INTO dispensing_history (patient_id, doctor_id, drug_name, dosage, formula_id) VALUES (?, ?, ?, ?, ?)', [patientId, userId, drugName, dosage, formulaId || null]);
        const logDetails = `จ่ายยา "${drugName}" ให้ผู้ป่วย HN: ${patientHn}`;
        await connection.query('INSERT INTO activity_log (user_id, action_type, details) VALUES (?, ?, ?)', [userId, 'DRUG_DISPENSE', logDetails]);
        await connection.commit();
        res.status(201).json({ message: 'บันทึกการจ่ายยาสำเร็จ' });
    } catch (error) {
        await connection.rollback();
        console.error('Error dispensing drug:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    } finally {
        connection.release();
    }
});

router.get('/patient-history/:hn', verifyToken, isDoctorNurseOrAdmin, async (req, res) => {
    const { hn } = req.params;
    if (!hn) { return res.status(400).json({ message: 'กรุณาระบุ HN ของผู้ป่วย' }); }
    try {
        const [patientRows] = await promisePool.query("SELECT id, fullname FROM patients WHERE hn = ?", [hn]);
        if (patientRows.length === 0) { return res.status(404).json({ message: 'ไม่พบผู้ป่วย HN นี้' }); }
        const patientId = patientRows[0].id; const patientFullname = patientRows[0].fullname;
        const [historyRows] = await promisePool.query(` SELECT dh.drug_name, dh.dosage, dh.dispensed_at, u.username AS doctor_name FROM dispensing_history dh LEFT JOIN users u ON dh.doctor_id = u.user_id WHERE dh.patient_id = ? ORDER BY dh.dispensed_at DESC `, [patientId]);
        res.json({ patientFullname: patientFullname, history: historyRows });
    } catch (error) { console.error('Error fetching patient history:', error); res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ' }); }
});

router.get('/dispensed-patients', verifyToken, isNurseOrAdmin, async (req, res) => {
    try {
        const [patients] = await promisePool.query(` SELECT DISTINCT p.hn, p.fullname FROM patients p JOIN dispensing_history dh ON p.id = dh.patient_id ORDER BY p.fullname ASC `);
        res.json(patients);
    } catch (error) { console.error('Error fetching dispensed patients list:', error); res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายชื่อผู้ป่วย' }); }
});

router.get('/patients-with-history', verifyToken, isNurseOrAdmin, async (req, res) => {
    try {
        const query = ` WITH RankedHistory AS ( SELECT p.id AS patient_id, p.hn, p.fullname, p.location, dh.drug_name, dh.dispensed_at, ROW_NUMBER() OVER(PARTITION BY p.id ORDER BY dh.dispensed_at DESC) as rn FROM patients p JOIN dispensing_history dh ON p.id = dh.patient_id ) SELECT patient_id, hn, fullname, location, drug_name, dispensed_at FROM RankedHistory WHERE rn <= 3 ORDER BY fullname ASC, dispensed_at DESC; `;
        const [rows] = await promisePool.query(query);
        const patientMap = new Map();
        rows.forEach(row => { if (!patientMap.has(row.patient_id)) { patientMap.set(row.patient_id, { hn: row.hn, fullname: row.fullname, location: row.location, history: [] }); } patientMap.get(row.patient_id).history.push({ drug_name: row.drug_name, dispensed_at: row.dispensed_at }); });
        res.json(Array.from(patientMap.values()));
    } catch (error) { console.error('Error fetching patients with history:', error); res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }); }
});

module.exports = router;