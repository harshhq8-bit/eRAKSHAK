"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsiaKolkataDateTime = getAsiaKolkataDateTime;
exports.processSecurityAlert = processSecurityAlert;
const supabaseService_js_1 = require("./supabaseService.js");
const twilioService_js_1 = require("./twilioService.js");
const sendgridService_js_1 = require("./sendgridService.js");
// In-memory anti-spam cache as fallback in addition to database
const lastAlertTimestampMap = new Map();
function getAsiaKolkataDateTime(date = new Date()) {
    const optionsDate = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    };
    const optionsTime = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    };
    const formattedDate = new Intl.DateTimeFormat('en-GB', optionsDate).format(date).replace(/\//g, '-');
    const formattedTime = new Intl.DateTimeFormat('en-US', optionsTime).format(date);
    return { date: formattedDate, time: formattedTime };
}
async function processSecurityAlert(options) {
    const supabase = (0, supabaseService_js_1.getSupabase)();
    const nowMs = Date.now();
    const { date, time } = getAsiaKolkataDateTime();
    console.log(`[AlertService] Processing security alert for device ${options.deviceName} (${options.deviceId})...`);
    // 1. Fetch notification settings for the owner
    let settings = null;
    if (options.userId) {
        const { data } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('user_id', options.userId)
            .maybeSingle();
        settings = data;
    }
    // Fallback defaults
    const cooldownSeconds = settings?.cooldown_seconds ?? 60;
    const cooldownMs = cooldownSeconds * 1000;
    // 2. Anti-spam cooldown check
    const lastAlertTime = lastAlertTimestampMap.get(options.deviceId) || 0;
    if (nowMs - lastAlertTime < cooldownMs) {
        const remaining = Math.round((cooldownMs - (nowMs - lastAlertTime)) / 1000);
        console.log(`[AlertService] Cooldown active for device ${options.deviceId}. Skipping notifications (${remaining}s remaining).`);
        return {
            cooldownActive: true,
            remainingSeconds: remaining,
            sms: 'COOLDOWN',
            email: 'COOLDOWN',
            call: 'COOLDOWN',
        };
    }
    lastAlertTimestampMap.set(options.deviceId, nowMs);
    const results = {
        sms: 'DISABLED',
        email: 'DISABLED',
        call: 'DISABLED',
    };
    // 3. Send SMS if enabled
    if (settings?.sms_enabled && settings?.phone_number) {
        const smsRes = await (0, twilioService_js_1.sendSecuritySms)({
            to: settings.phone_number,
            deviceName: options.deviceName,
            time,
            date,
            distanceCm: options.distanceCm,
        });
        results.sms = smsRes.success ? 'SENT' : `FAILED: ${smsRes.error}`;
    }
    // 4. Send Email if enabled
    if (settings?.email_enabled && settings?.email_address) {
        const emailRes = await (0, sendgridService_js_1.sendSecurityEmail)({
            to: settings.email_address,
            deviceName: options.deviceName,
            time,
            date,
            distanceCm: options.distanceCm,
        });
        results.email = emailRes.success ? 'SENT' : `FAILED: ${emailRes.error}`;
    }
    // 5. Make Voice Call if enabled
    if (settings?.call_enabled && settings?.phone_number) {
        const callRes = await (0, twilioService_js_1.makeSecurityVoiceCall)({
            to: settings.phone_number,
        });
        results.call = callRes.success ? 'INITIATED' : `FAILED: ${callRes.error}`;
    }
    const notificationSummary = `SMS:${results.sms}|EMAIL:${results.email}|CALL:${results.call}`;
    // 6. Update access_event if eventId is provided
    if (options.eventId) {
        await supabase
            .from('access_events')
            .update({ notification_status: notificationSummary })
            .eq('id', options.eventId);
    }
    // 7. Log to system_logs
    await supabase.from('system_logs').insert({
        device_id: options.deviceId,
        user_id: options.userId,
        event: 'UNAUTHORIZED_ALERT_SENT',
        metadata: {
            results,
            distanceCm: options.distanceCm,
            timestamp: new Date().toISOString(),
        },
    });
    return {
        cooldownActive: false,
        ...results,
    };
}
