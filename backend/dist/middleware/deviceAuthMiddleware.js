"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDeviceAuth = requireDeviceAuth;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabaseService_js_1 = require("../services/supabaseService.js");
async function requireDeviceAuth(req, res, next) {
    const deviceId = req.headers['x-device-id'] || req.params.deviceId;
    const apiKey = req.headers['x-device-key'] || req.headers['x-api-key'];
    if (!deviceId) {
        res.status(400).json({ error: 'Device ID is required in headers (x-device-id) or URL parameters' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        // Look up by id or device_uid
        const { data: device, error } = await supabase
            .from('devices')
            .select('*')
            .or(`id.eq.${deviceId},device_uid.eq.${deviceId}`)
            .maybeSingle();
        if (error || !device) {
            res.status(404).json({ error: `Device not found for ID: ${deviceId}` });
            return;
        }
        // If an API key is provided, verify it. If device has no api_key_hash set or key matches, allow.
        if (device.api_key_hash && apiKey) {
            const match = await bcryptjs_1.default.compare(apiKey, device.api_key_hash).catch(() => false);
            const directMatch = apiKey === device.api_key_hash; // In case plain text key was stored during development
            if (!match && !directMatch) {
                res.status(401).json({ error: 'Invalid device API key' });
                return;
            }
        }
        req.device = device;
        next();
    }
    catch (err) {
        res.status(500).json({ error: 'Device authentication check failed: ' + err.message });
    }
}
