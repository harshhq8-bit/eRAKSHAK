"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabaseService_js_1 = require("../services/supabaseService.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const alertService_js_1 = require("../services/alertService.js");
const router = (0, express_1.Router)();
// 1. POST /api/mobile/generate-code - Generate 6-digit pairing code for device
router.post('/generate-code', authMiddleware_js_1.requireAuth, async (req, res) => {
    const { device_id, device_name } = req.body;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    // Generate random 6-digit code e.g. "849201"
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const { data: mobile, error } = await supabase
            .from('mobile_devices')
            .insert({
            owner_id: req.user.id,
            device_name: device_name || 'Android Security Camera',
            pairing_code: pairingCode,
            online: false,
            camera_status: 'NOT_READY',
            recognition_status: 'OFFLINE',
        })
            .select()
            .single();
        if (error)
            throw error;
        res.json({
            success: true,
            pairingCode,
            mobileDevice: mobile,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to generate pairing code: ' + err.message });
    }
});
// 2. POST /api/mobile/pair - Mobile companion enters 6-digit pairing code to pair
router.post('/pair', async (req, res) => {
    const { pairingCode, deviceName } = req.body;
    if (!pairingCode) {
        res.status(400).json({ error: 'Pairing code is required' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: mobile, error } = await supabase
            .from('mobile_devices')
            .select('*, profiles:owner_id(name, email)')
            .eq('pairing_code', pairingCode.trim())
            .maybeSingle();
        if (error || !mobile) {
            res.status(404).json({ error: 'Invalid or expired pairing code' });
            return;
        }
        // Mark mobile as online and paired
        const { data: updated, error: updateErr } = await supabase
            .from('mobile_devices')
            .update({
            online: true,
            camera_status: 'READY',
            recognition_status: 'READY',
            last_seen: new Date().toISOString(),
            ...(deviceName ? { device_name: deviceName } : {}),
        })
            .eq('id', mobile.id)
            .select()
            .single();
        if (updateErr)
            throw updateErr;
        // Get the owner's primary device
        const { data: devices } = await supabase
            .from('devices')
            .select('id, device_name, device_uid')
            .eq('owner_id', mobile.owner_id)
            .limit(1);
        const primaryDevice = devices && devices.length > 0 ? devices[0] : null;
        res.json({
            success: true,
            message: 'Mobile successfully paired with Simple IoT World',
            mobileDevice: updated,
            primaryDevice,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Pairing failed: ' + err.message });
    }
});
// 3. POST /api/mobile/heartbeat - Mobile sends periodic heartbeat & status
router.post('/heartbeat', async (req, res) => {
    const { mobileId, pairingCode, cameraStatus, recognitionStatus } = req.body;
    if (!mobileId && !pairingCode) {
        res.status(400).json({ error: 'mobileId or pairingCode required' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const query = supabase
            .from('mobile_devices')
            .update({
            online: true,
            last_seen: new Date().toISOString(),
            ...(cameraStatus ? { camera_status: cameraStatus } : {}),
            ...(recognitionStatus ? { recognition_status: recognitionStatus } : {}),
        });
        if (mobileId) {
            query.eq('id', mobileId);
        }
        else {
            query.eq('pairing_code', pairingCode);
        }
        const { error } = await query;
        if (error)
            throw error;
        res.json({ success: true, timestamp: new Date().toISOString() });
    }
    catch (err) {
        res.status(500).json({ error: 'Mobile heartbeat failed: ' + err.message });
    }
});
// 4. GET /api/mobile/:deviceId/status - Fetch mobile camera and recognition status
router.get('/:deviceId/status', async (req, res) => {
    const { deviceId } = req.params;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        // Find device owner first
        const { data: device } = await supabase
            .from('devices')
            .select('owner_id')
            .or(`id.eq.${deviceId},device_uid.eq.${deviceId}`)
            .maybeSingle();
        const ownerId = device?.owner_id || 'demo-user-id-01';
        const { data: mobile } = await supabase
            .from('mobile_devices')
            .select('*')
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        // Check online status based on last_seen (within 30 seconds)
        const isOnline = mobile?.last_seen && (Date.now() - new Date(mobile.last_seen).getTime()) < 30000;
        res.json({
            success: true,
            mobile: mobile
                ? {
                    ...mobile,
                    online: isOnline,
                }
                : null,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch mobile status: ' + err.message });
    }
});
// 5. POST /api/mobile/:deviceId/face-result - Mobile app posts face recognition result
router.post('/:deviceId/face-result', async (req, res) => {
    const { deviceId } = req.params;
    const { result, personName, confidence, distanceCm } = req.body;
    if (!result || !['AUTHORIZED', 'UNAUTHORIZED', 'UNKNOWN'].includes(result)) {
        res.status(400).json({ error: 'result must be AUTHORIZED, UNAUTHORIZED, or UNKNOWN' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: device, error: devErr } = await supabase
            .from('devices')
            .select('*')
            .or(`id.eq.${deviceId},device_uid.eq.${deviceId}`)
            .maybeSingle();
        if (devErr || !device) {
            res.status(404).json({ error: 'Device not found' });
            return;
        }
        // Save event
        const { data: newEvent, error: evErr } = await supabase
            .from('access_events')
            .insert({
            device_id: device.id,
            user_id: device.owner_id,
            face_name: personName || (result === 'AUTHORIZED' ? 'Authorized Person' : 'Unknown Person'),
            recognition_result: result,
            confidence: confidence !== undefined ? parseFloat(confidence) : null,
            distance_cm: distanceCm !== undefined ? parseFloat(distanceCm) : null,
            event_type: 'MOBILE_FACE_RECOGNITION',
        })
            .select()
            .single();
        if (evErr)
            throw evErr;
        // Handle security alerting & hardware commands
        let alertResult = null;
        if (result === 'UNAUTHORIZED' || result === 'UNKNOWN') {
            alertResult = await (0, alertService_js_1.processSecurityAlert)({
                deviceId: device.id,
                deviceName: device.device_name,
                userId: device.owner_id,
                distanceCm,
                eventId: newEvent.id,
            });
            // Queue physical alert for ESP8266
            await supabase.from('device_commands').insert({
                device_id: device.id,
                command_type: 'UNAUTHORIZED',
                payload: { buzzer: 'ON', led: 'ON', line1: 'ACCESS:', line2: 'UNAUTHORIZED' },
            });
        }
        else {
            // AUTHORIZED
            await supabase.from('device_commands').insert({
                device_id: device.id,
                command_type: 'AUTHORIZED',
                payload: { buzzer: 'OFF', led: 'ON', line1: 'ACCESS:', line2: 'AUTHORIZED' },
            });
        }
        res.json({
            success: true,
            message: `Face recognition result: ${result}`,
            event: newEvent,
            alert: alertResult,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to record face recognition result: ' + err.message });
    }
});
exports.default = router;
