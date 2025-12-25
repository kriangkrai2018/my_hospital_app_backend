const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: true, message: 'ไม่มี token' });
    }
    const token = authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).json({ error: true, message: 'Token ไม่ถูกต้อง' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('Token verification error:', err);
            return res.status(403).json({ error: true, message: 'Token ไม่ถูกต้องหรือไม่ได้รับสิทธิ์' });
        }
        req.user = decoded;
        next();
    });
}

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: true, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (เฉพาะ Admin)' });
    }
};

const isAdminOrDoctor = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'doctor')) {
        next();
    } else {
        res.status(403).json({ error: true, message: 'คุณไม่มีสิทธิ์สร้างสูตรยา' });
    }
};

const isDoctorNurseOrAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'doctor' || req.user.role === 'nurse')) {
        next();
    } else {
        res.status(403).json({ error: true, message: 'คุณไม่มีสิทธิ์จัดการข้อมูลผู้ป่วย' });
    }
};

const isNurseOrAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'nurse' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ error: true, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (เฉพาะ Nurse หรือ Admin)' });
    }
};

// (⭐⭐⭐ นำฟังก์ชันนี้กลับมา ⭐⭐⭐)
const isAnyAuthenticatedUser = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'doctor' || req.user.role === 'user' || req.user.role === 'nurse')) {
        next();
    } else {
        res.status(403).json({ error: true, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
    }
};

module.exports = { 
    verifyToken, 
    isAdmin, 
    isAdminOrDoctor, 
    isAnyAuthenticatedUser, // <-- นำกลับมา
    isDoctorNurseOrAdmin,
    isNurseOrAdmin
};