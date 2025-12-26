const express = require("express");
require('dotenv').config();
const path = require('path');
const cors = require("cors");

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

// --- Handle Page Navigation ---
// ทำให้เมื่อเข้าหน้าแรก (/) จะไปที่ login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});

// --- Generate frontend config for static pages (so frontend reads API_BASE from one place)
const fs = require('fs');
const frontendPublicJsDir = path.join(__dirname, '..', 'my_hospital_app_frontend', 'public', 'JS');
const frontendConfigPath = path.join(frontendPublicJsDir, 'app-config.js');
function writeFrontendConfig() {
    const host = process.env.FRONTEND_API_HOST || '127.0.0.1';
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

// --- Server Start ---
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Serving static files from: ${publicPath}`);
});

