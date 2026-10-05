"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const env_js_1 = require("./config/env.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const frontendPath = path_1.default.resolve(__dirname, '../../frontend');
// Route imports
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const devices_routes_js_1 = __importDefault(require("./routes/devices.routes.js"));
const mobile_routes_js_1 = __importDefault(require("./routes/mobile.routes.js"));
const notifications_routes_js_1 = __importDefault(require("./routes/notifications.routes.js"));
const events_routes_js_1 = __importDefault(require("./routes/events.routes.js"));
const app = (0, express_1.default)();
// Security and utility middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use((0, cors_1.default)({
    origin: '*', // Allow cloud dashboard & local ESP/mobile access
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-device-key', 'x-api-key'],
}));
app.use((0, morgan_1.default)(env_js_1.ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        system: 'eRAKSHAK Smart Security Cloud Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        timezone: 'Asia/Kolkata',
    });
});
// Mount Routes
app.use('/api/auth', auth_routes_js_1.default);
app.use('/api/devices', devices_routes_js_1.default);
app.use('/api/mobile', mobile_routes_js_1.default);
app.use('/api/notifications', notifications_routes_js_1.default);
app.use('/api/events', events_routes_js_1.default);
// Serve static HTML frontend
app.use(express_1.default.static(frontendPath));
// Web page route fallback (non-API)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
// 404 Handler for undefined API routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    });
});
// Centralized Error Handler
app.use(errorHandler_js_1.errorHandler);
// Start Server
const server = app.listen(env_js_1.ENV.PORT, () => {
    console.log(`=======================================================`);
    console.log(`🛡️ eRAKSHAK Cloud Backend running on port ${env_js_1.ENV.PORT}`);
    console.log(`📡 Environment: ${env_js_1.ENV.NODE_ENV}`);
    console.log(`🔗 API Base: ${env_js_1.ENV.RENDER_API_URL || `http://localhost:${env_js_1.ENV.PORT}`}`);
    console.log(`=======================================================`);
});
process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection at]:', promise, 'reason:', reason);
});
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
exports.default = app;
