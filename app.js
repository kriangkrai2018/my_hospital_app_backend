const express = require("express");
require('dotenv').config();
const path = require('path');
const cors = require("cors");
const fs = require('fs');

const app = express();
const port = process.env.PORT_HTTP || 36142;

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
// Use the project's `public` folder relative to the repository root so path is portable across OSes
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Also serve the frontend project's public folder so frontend and API share the same origin.
const frontendStaticPath = path.join(__dirname, '..', 'my_hospital_app_frontend', 'public');
if (fs.existsSync(frontendStaticPath)) {
    app.use('/', express.static(frontendStaticPath));
    console.log(`Also serving frontend static from: ${frontendStaticPath}`);
}

// --- Handle Page Navigation ---
// ทำให้เมื่อเข้หน้าแรก (/) จะไปที่ login.html (พยายามหาใน backend/public ก่อน ถ้าไม่มี ใช้ frontend/public)
app.get('/', (req, res) => {
    const localLogin = path.join(publicPath, 'login.html');
    const frontendLogin = path.join(__dirname, '..', 'my_hospital_app_frontend', 'public', 'login.html');
    if (fs.existsSync(localLogin)) {
        return res.sendFile(localLogin);
    } else if (fs.existsSync(frontendLogin)) {
        return res.sendFile(frontendLogin);
    } else {
        return res.status(404).send('Login page not found. Please ensure frontend build is present.');
    }
});

// --- Generate frontend config for static pages (so frontend reads API_BASE from one place)
const frontendPublicJsDir = path.join(__dirname, '..', 'my_hospital_app_frontend', 'public', 'JS');
const frontendConfigPath = path.join(frontendPublicJsDir, 'app-config.js');
function writeFrontendConfig() {
    const host = process.env.FRONTEND_API_HOST || 'project.3bbddns.com';
    const portForFrontend = process.env.PORT_HTTP || port;
    const apiBase = `http://${host}:${portForFrontend}`;
    const content = `window.APP_CONFIG = window.APP_CONFIG || {}; window.APP_CONFIG.API_BASE = '${apiBase}';`;
    try {
        if (!fs.existsSync(frontendPublicJsDir)) {
            fs.mkdirSync(frontendPublicJsDir, { recursive: true });
        }
        fs.writeFileSync(frontendConfigPath, content, 'utf8');
        console.log(`Wrote frontend config to ${frontendConfigPath}: API_BASE=${apiBase}`);
    } catch (err) {
        console.error('Failed to write frontend config:', err);
    }
}

writeFrontendConfig();

// Serve app-config.js with no-cache headers so clients always fetch current API_BASE
app.get('/JS/app-config.js', (req, res) => {
    try {
        const content = fs.readFileSync(frontendConfigPath, 'utf8');
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(content);
    } catch (err) {
        res.status(404).send('// app-config.js not found');
    }
});

// --- Server Start ---
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Serving static files from: ${publicPath}`);
});

