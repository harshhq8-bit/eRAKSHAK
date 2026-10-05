"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabaseService_js_1 = require("../services/supabaseService.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const twilioService_js_1 = require("../services/twilioService.js");
const sendgridService_js_1 = require("../services/sendgridService.js");
const alertService_js_1 = require("../services/alertService.js");
const router = (0, express_1.Router)();
// 1. GET /api/notifications/settings - Get user's notification settings
router.get('/settings', authMiddleware_js_1.requireAuth, async (req, res) => {
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: settings, error } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('user_id', req.user.id)
            .maybeSingle();
        if (error)
            throw error;
        res.json({
            success: true,
            settings: settings || {
                sms_enabled: true,
                email_enabled: true,
                call_enabled: false,
                cooldown_seconds: 60,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings: ' + err.message });
    }
});
// 2. PUT /api/notifications/settings - Update notification settings
router.put('/settings', authMiddleware_js_1.requireAuth, async (req, res) => {
    const { sms_enabled, email_enabled, call_enabled, phone_number, email_address, cooldown_seconds } = req.body;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: updated, error } = await supabase
            .from('notification_settings')
            .upsert({
            user_id: req.user.id,
            sms_enabled: Boolean(sms_enabled),
            email_enabled: Boolean(email_enabled),
            call_enabled: Boolean(call_enabled),
            phone_number: phone_number || null,
            email_address: email_address || req.user.email,
            cooldown_seconds: parseInt(cooldown_seconds || '60', 10),
        }, { onConflict: 'user_id' })
            .select()
            .single();
        if (error)
            throw error;
        res.json({
            success: true,
            message: 'Notification settings saved successfully',
            settings: updated,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to save settings: ' + err.message });
    }
});
// 3. POST /api/notifications/sms - Test SMS notification
router.post('/sms', authMiddleware_js_1.requireAuth, async (req, res) => {
    const { to, deviceName, distanceCm } = req.body;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    let targetPhone = to;
    if (!targetPhone) {
        const { data: settings } = await supabase
            .from('notification_settings')
            .select('phone_number')
            .eq('user_id', req.user.id)
            .maybeSingle();
        targetPhone = settings?.phone_number;
    }
    if (!targetPhone) {
        res.status(400).json({ error: 'Recipient phone number is required (configure in notification settings)' });
        return;
    }
    const { date, time } = (0, alertService_js_1.getAsiaKolkataDateTime)();
    const result = await (0, twilioService_js_1.sendSecuritySms)({
        to: targetPhone,
        deviceName: deviceName || 'eRAKSHAK-NodeMCU-01',
        time,
        date,
        distanceCm: distanceCm || 45,
    });
    res.json({
        success: result.success,
        message: result.success ? `Test SMS sent to ${targetPhone}` : `Failed to send SMS: ${result.error}`,
        sid: result.sid,
        error: result.error,
    });
});
// 4. POST /api/notifications/email - Test Email notification
router.post('/email', authMiddleware_js_1.requireAuth, async (req, res) => {
    const { to, deviceName, distanceCm } = req.body;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    let targetEmail = to;
    if (!targetEmail) {
        const { data: settings } = await supabase
            .from('notification_settings')
            .select('email_address')
            .eq('user_id', req.user.id)
            .maybeSingle();
        targetEmail = settings?.email_address || req.user.email;
    }
    if (!targetEmail) {
        res.status(400).json({ error: 'Recipient email address is required' });
        return;
    }
    const { date, time } = (0, alertService_js_1.getAsiaKolkataDateTime)();
    const result = await (0, sendgridService_js_1.sendSecurityEmail)({
        to: targetEmail,
        deviceName: deviceName || 'eRAKSHAK-NodeMCU-01',
        time,
        date,
        distanceCm: distanceCm || 45,
    });
    res.json({
        success: result.success,
        message: result.success ? `Test Email sent to ${targetEmail}` : `Failed to send Email: ${result.error}`,
        error: result.error,
    });
});
// 5. POST /api/notifications/call - Test Voice Call notification
router.post('/call', authMiddleware_js_1.requireAuth, async (req, res) => {
    const { to } = req.body;
    const supabase = (0, supabaseService_js_1.getSupabase)();
    let targetPhone = to;
    if (!targetPhone) {
        const { data: settings } = await supabase
            .from('notification_settings')
            .select('phone_number')
            .eq('user_id', req.user.id)
            .maybeSingle();
        targetPhone = settings?.phone_number;
    }
    if (!targetPhone) {
        res.status(400).json({ error: 'Recipient phone number is required (configure in notification settings)' });
        return;
    }
    const result = await (0, twilioService_js_1.makeSecurityVoiceCall)({
        to: targetPhone,
    });
    res.json({
        success: result.success,
        message: result.success ? `Test Voice Call initiated to ${targetPhone}` : `Failed to initiate call: ${result.error}`,
        sid: result.sid,
        error: result.error,
    });
});
exports.default = router;
