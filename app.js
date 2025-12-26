const express = require("express");
require('dotenv').config();
const path = require('path');
const cors = require("cors");

const app = express();
const port = process.env.PORT_HTTP || 4200;

// Middleware
app.use(cors());
app.use(express.json()); // ใช้ express.json() แทน bodyParser
app.use(express.urlencoded({ extended: true })); // ใช้ express.urlencoded() แทน bodyParser

// --- API Routes ---
const authRouter = require(path.join(__dirname, "routes", "auth.js"));
const adminRouter = require(path.join(__dirname, 'routes', 'admin.js'));
const doctorRouter = require(path.join(__dirname, 'routes', 'doctor.js'));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/doctor", doctorRouter);

// --- Serve Static Files ---
// !! สำคัญ: กำหนด Path ไปยังโฟลเดอร์ public ของคุณให้ถูกต้อง !!
// นี่เป็น Path แบบตายตัว (Hardcoded) ที่เคยทำงานได้ในเครื่องของคุณ
// หากคุณย้ายโปรเจกต์ไปไว้ที่อื่น จะต้องมาแก้ไข Path นี้ใหม่
const publicPath = "C:/xampp/htdocs/my_hospital_app_backend/public"; 
app.use(express.static(publicPath));

// --- Handle Page Navigation ---
// ทำให้เมื่อเข้าหน้าแรก (/) จะไปที่ login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});

// --- Server Start ---
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Serving static files from: ${publicPath}`);
});

