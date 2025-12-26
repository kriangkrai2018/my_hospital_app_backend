const express = require("express");
require('dotenv').config();
const path = require('path');
const fs = require('fs');
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
// Serve the frontend `public` folder so frontend and API are same-origin in dev
const publicPath = path.join(__dirname, '..', 'my_hospital_app_frontend', 'public');

if (!fs.existsSync(publicPath)) {
    console.warn('Warning: frontend public folder not found at', publicPath);
    console.warn('If you want to serve the frontend from backend, ensure the path above is correct.');
}

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

