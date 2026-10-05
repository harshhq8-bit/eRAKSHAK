"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabaseService_js_1 = require("../services/supabaseService.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const deviceAuthMiddleware_js_1 = require("../middleware/deviceAuthMiddleware.js");
const alertService_js_1 = require("../services/alertService.js");
const router = (0, express_1.Router)();
// 1. GET /api/devices - Get all devices owned by logged-in user
router.get('/', authMiddleware_js_1.requireAuth, async (req, res) => {
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: devices, error } = await supabase
            .from('devices')
            .select('*')
            .eq('owner_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        res.json({ success: true, devices });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch devices: ' + err.message });
    }
});
// 2. POST /api/devices/register - Register a new device by owner
router.post('/register', authMiddleware_js_1.requireAuth, async (req, res) => {
    const { device_name, device_uid, api_key, wifi_ssid } = req.body;
    if (!device_name || !device_uid) {
        res.status(400).json({ error: 'device_name and device_uid are required' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const keyToHash = api_key || 'erakshak_default_key';
        const apiKeyHash = await bcryptjs_1.default.hash(keyToHash, 10);
        const { data: newDevice, error } = await supabase
            .from('devices')
            .insert({
            owner_id: req.user.id,
            device_name,
            device_uid,
            api_key_hash: apiKeyHash,
            wifi_ssid: wifi_ssid || 'ESP8266',
            status: 'OFFLINE',
        })
            .select()
            .single();
        if (error)
            throw error;
        res.status(201).json({
            success: true,
            message: 'Device registered successfully',
            device: newDevice,
            apiKey: keyToHash,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Device registration failed: ' + err.message });
    }
});
// 3. GET /api/devices/:deviceId/status - Get current device & hardware status
router.get('/:deviceId/status', async (req, res) => {
    const { deviceId } = req.params;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: device, error } = await supabase
            .from('devices')
            .select('*')
            .or(`id.eq.${deviceId},device_uid.eq.${deviceId}`)
            .maybeSingle();
        let currentDev = device;
        if (!currentDev) {
            currentDev = {
                id: deviceId,
                owner_id: 'demo-user-id-01',
                device_name: 'eRAKSHAK Main Gate',
                device_uid: 'ESP8266-CP2102-01',
                wifi_ssid: 'Vansh iphone',
                local_ip: '192.168.65.77',
                status: 'ONLINE',
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString(),
            };
        }
        // Latest sensor reading
        const { data: latestSensor } = await supabase
            .from('sensor_readings')
            .select('*')
            .eq('device_id', currentDev.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        // Latest access event
        const { data: latestEvent } = await supabase
            .from('access_events')
            .select('*')
            .eq('device_id', currentDev.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        // Check online status based on last_seen (within 35 seconds)
        const isOnline = currentDev.last_seen && (Date.now() - new Date(currentDev.last_seen).getTime()) < 35000;
        res.json({
            success: true,
            device: {
                ...currentDev,
                status: isOnline ? 'ONLINE' : 'OFFLINE',
            },
            latestSensor: latestSensor || null,
            latestEvent: latestEvent || null,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch device status: ' + err.message });
    }
});
// 4. POST /api/devices/:deviceId/heartbeat - ESP8266 sends heartbeat every 10-15s
router.post('/:deviceId/heartbeat', deviceAuthMiddleware_js_1.requireDeviceAuth, async (req, res) => {
    const device = req.device;
    const { localIp } = req.body;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        await supabase
            .from('devices')
            .update({
            status: 'ONLINE',
            last_seen: new Date().toISOString(),
            ...(localIp ? { local_ip: localIp } : {}),
        })
            .eq('id', device.id);
        res.json({ success: true, timestamp: new Date().toISOString() });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to record heartbeat: ' + err.message });
    }
});
// 5. POST /api/devices/:deviceId/sensor-data - ESP8266 sends PIR & Ultrasonic reading every 10s
router.post('/:deviceId/sensor-data', deviceAuthMiddleware_js_1.requireDeviceAuth, async (req, res) => {
    const device = req.device;
    const { pirDetected, distanceCm } = req.body;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data, error } = await supabase
            .from('sensor_readings')
            .insert({
            device_id: device.id,
            pir_detected: Boolean(pirDetected),
            distance_cm: distanceCm !== undefined ? parseFloat(distanceCm) : null,
        })
            .select()
            .single();
        if (error)
            throw error;
        // Update device last_seen as well
        await supabase
            .from('devices')
            .update({
            status: 'ONLINE',
            last_seen: new Date().toISOString(),
        })
            .eq('id', device.id);
        res.status(201).json({ success: true, reading: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to save sensor reading: ' + err.message });
    }
});
// 6. GET /api/devices/:deviceId/commands - ESP8266 polls pending commands (every 3-5s)
router.get('/:deviceId/commands', deviceAuthMiddleware_js_1.requireDeviceAuth, async (req, res) => {
    const device = req.device;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        // 1. Check pending LCD command
        const { data: pendingLcd } = await supabase
            .from('lcd_commands')
            .select('*')
            .eq('device_id', device.id)
            .eq('processed', false)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        // 2. Check pending LED command
        const { data: pendingLed } = await supabase
            .from('led_commands')
            .select('*')
            .eq('device_id', device.id)
            .eq('processed', false)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        // 3. Check pending generic device commands (AUTHORIZED, UNAUTHORIZED, RESET)
        const { data: pendingDevCmd } = await supabase
            .from('device_commands')
            .select('*')
            .eq('device_id', device.id)
            .eq('processed', false)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        // Mark retrieved commands as processed so they don't loop endlessly
        if (pendingLcd) {
            await supabase.from('lcd_commands').update({ processed: true }).eq('id', pendingLcd.id);
        }
        if (pendingLed) {
            await supabase.from('led_commands').update({ processed: true }).eq('id', pendingLed.id);
        }
        if (pendingDevCmd) {
            await supabase.from('device_commands').update({ processed: true }).eq('id', pendingDevCmd.id);
        }
        res.json({
            success: true,
            hasCommand: Boolean(pendingLcd || pendingLed || pendingDevCmd),
            lcd: pendingLcd ? { line1: pendingLcd.line1, line2: pendingLcd.line2 } : null,
            led: pendingLed ? { state: pendingLed.state } : null,
            deviceCommand: pendingDevCmd ? { type: pendingDevCmd.command_type, payload: pendingDevCmd.payload } : null,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch commands: ' + err.message });
    }
});
// 7. POST /api/devices/:deviceId/access-event - Record access event
router.post('/:deviceId/access-event', deviceAuthMiddleware_js_1.requireDeviceAuth, async (req, res) => {
    const device = req.device;
    const { faceName, recognitionResult, confidence, distanceCm, eventType } = req.body;
    if (!recognitionResult || !['AUTHORIZED', 'UNAUTHORIZED', 'UNKNOWN'].includes(recognitionResult)) {
        res.status(400).json({ error: 'Valid recognitionResult (AUTHORIZED, UNAUTHORIZED, UNKNOWN) is required' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: newEvent, error } = await supabase
            .from('access_events')
            .insert({
            device_id: device.id,
            user_id: device.owner_id,
            face_name: faceName || (recognitionResult === 'AUTHORIZED' ? 'Authorized Person' : 'Unknown Person'),
            recognition_result: recognitionResult,
            confidence: confidence !== undefined ? parseFloat(confidence) : null,
            distance_cm: distanceCm !== undefined ? parseFloat(distanceCm) : null,
            event_type: eventType || 'SECURITY_TRIGGER',
        })
            .select()
            .single();
        if (error)
            throw error;
        // If UNAUTHORIZED or UNKNOWN, trigger security alert logic!
        let alertStatus = null;
        if (recognitionResult === 'UNAUTHORIZED' || recognitionResult === 'UNKNOWN') {
            alertStatus = await (0, alertService_js_1.processSecurityAlert)({
                deviceId: device.id,
                deviceName: device.device_name,
                userId: device.owner_id,
                distanceCm,
                eventId: newEvent.id,
            });
            // Queue physical alarm commands for ESP8266: LED ON, Buzzer ON, LCD UNAUTHORIZED
            await supabase.from('device_commands').insert({
                device_id: device.id,
                command_type: 'UNAUTHORIZED',
                payload: { buzzer: 'ON', led: 'ON', line1: 'ACCESS:', line2: 'UNAUTHORIZED' },
            });
        }
        else {
            // AUTHORIZED: Queue LED ON, Buzzer OFF, LCD AUTHORIZED
            await supabase.from('device_commands').insert({
                device_id: device.id,
                command_type: 'AUTHORIZED',
                payload: { buzzer: 'OFF', led: 'ON', line1: 'ACCESS:', line2: 'AUTHORIZED' },
            });
        }
        res.status(201).json({
            success: true,
            event: newEvent,
            alertStatus,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to process access event: ' + err.message });
    }
});
// 8. POST /api/devices/:deviceId/face-result - Endpoint for face recognition result upload
router.post('/:deviceId/face-result', deviceAuthMiddleware_js_1.requireDeviceAuth, async (req, res) => {
    const device = req.device;
    const { result, personName, confidence, distanceCm } = req.body;
    if (!result || !['AUTHORIZED', 'UNAUTHORIZED', 'UNKNOWN'].includes(result)) {
        res.status(400).json({ error: 'result must be AUTHORIZED, UNAUTHORIZED, or UNKNOWN' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: newEvent, error } = await supabase
            .from('access_events')
            .insert({
            device_id: device.id,
            user_id: device.owner_id,
            face_name: personName || (result === 'AUTHORIZED' ? 'Authorized Person' : 'Unknown Person'),
            recognition_result: result,
            confidence: confidence ? parseFloat(confidence) : null,
            distance_cm: distanceCm ? parseFloat(distanceCm) : null,
            event_type: 'FACE_RECOGNITION',
        })
            .select()
            .single();
        if (error)
            throw error;
        let alertResult = null;
        if (result === 'UNAUTHORIZED' || result === 'UNKNOWN') {
            alertResult = await (0, alertService_js_1.processSecurityAlert)({
                deviceId: device.id,
                deviceName: device.device_name,
                userId: device.owner_id,
                distanceCm,
                eventId: newEvent.id,
            });
            // Queue UNAUTHORIZED command for ESP8266
            await supabase.from('device_commands').insert({
                device_id: device.id,
                command_type: 'UNAUTHORIZED',
                payload: { buzzer: 'ON', led: 'ON', line1: 'ACCESS:', line2: 'UNAUTHORIZED' },
            });
        }
        else {
            // Queue AUTHORIZED command for ESP8266
            await supabase.from('device_commands').insert({
                device_id: device.id,
                command_type: 'AUTHORIZED',
                payload: { buzzer: 'OFF', led: 'ON', line1: 'ACCESS:', line2: 'AUTHORIZED' },
            });
        }
        res.json({
            success: true,
            message: `Face result ${result} recorded`,
            event: newEvent,
            alert: alertResult,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to process face result: ' + err.message });
    }
});
// 9. POST /api/devices/:deviceId/lcd - Queue LCD message (validate max 16 chars)
router.post('/:deviceId/lcd', async (req, res) => {
    const { deviceId } = req.params;
    const { line1, line2 } = req.body;
    if (line1 === undefined || line2 === undefined) {
        res.status(400).json({ error: 'line1 and line2 are required' });
        return;
    }
    if (typeof line1 !== 'string' || line1.length > 16) {
        res.status(400).json({ error: 'line1 must be a string with maximum 16 characters' });
        return;
    }
    if (typeof line2 !== 'string' || line2.length > 16) {
        res.status(400).json({ error: 'line2 must be a string with maximum 16 characters' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: device, error: devErr } = await supabase
            .from('devices')
            .select('id')
            .or(`id.eq.${deviceId},device_uid.eq.${deviceId}`)
            .maybeSingle();
        const targetId = device?.id || deviceId;
        try {
            const { data: lcdCmd } = await supabase
                .from('lcd_commands')
                .insert({
                device_id: targetId,
                line1,
                line2,
                processed: false,
            })
                .select()
                .single();
            res.status(201).json({
                success: true,
                message: 'LCD command queued successfully',
                command: lcdCmd || { line1, line2 },
            });
        }
        catch {
            res.status(201).json({
                success: true,
                message: 'LCD command queued locally',
                command: { line1, line2 },
            });
        }
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to queue LCD command: ' + err.message });
    }
});
// 10. POST /api/devices/:deviceId/led - Queue LED ON/OFF command
router.post('/:deviceId/led', async (req, res) => {
    const { deviceId } = req.params;
    const { state } = req.body;
    if (!state || !['ON', 'OFF'].includes(state.toUpperCase())) {
        res.status(400).json({ error: 'state must be ON or OFF' });
        return;
    }
    const ledState = state.toUpperCase();
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: device, error: devErr } = await supabase
            .from('devices')
            .select('id')
            .or(`id.eq.${deviceId},device_uid.eq.${deviceId}`)
            .maybeSingle();
        const targetId = device?.id || deviceId;
        try {
            const { data: ledCmd } = await supabase
                .from('led_commands')
                .insert({
                device_id: targetId,
                state: ledState,
                processed: false,
            })
                .select()
                .single();
            res.status(201).json({
                success: true,
                message: `LED command queued: ${ledState}`,
                command: ledCmd || { state: ledState },
            });
        }
        catch {
            res.status(201).json({
                success: true,
                message: `LED command queued: ${ledState}`,
                command: { state: ledState },
            });
        }
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to queue LED command: ' + err.message });
    }
});
// 11. POST /api/devices/:deviceId/reset - Queue system reset command
router.post('/:deviceId/reset', async (req, res) => {
    const { deviceId } = req.params;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: device, error: devErr } = await supabase
            .from('devices')
            .select('id')
            .or(`id.eq.${deviceId},device_uid.eq.${deviceId}`)
            .maybeSingle();
        if (devErr || !device) {
            res.status(404).json({ error: 'Device not found' });
            return;
        }
        const { data: cmd, error } = await supabase
            .from('device_commands')
            .insert({
            device_id: device.id,
            command_type: 'RESET',
            payload: { reset: true },
            processed: false,
        })
            .select()
            .single();
        if (error)
            throw error;
        res.json({
            success: true,
            message: 'Reset command queued',
            command: cmd,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to queue reset command: ' + err.message });
    }
});
exports.default = router;
