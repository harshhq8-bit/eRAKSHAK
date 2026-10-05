"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSecuritySms = sendSecuritySms;
exports.makeSecurityVoiceCall = makeSecurityVoiceCall;
const twilio_1 = __importDefault(require("twilio"));
const env_js_1 = require("../config/env.js");
let twilioClient = null;
function getTwilioClient() {
    if (twilioClient)
        return twilioClient;
    if (env_js_1.ENV.TWILIO_ACCOUNT_SID && env_js_1.ENV.TWILIO_AUTH_TOKEN && !env_js_1.ENV.TWILIO_ACCOUNT_SID.startsWith('ACXXXXX')) {
        try {
            twilioClient = (0, twilio_1.default)(env_js_1.ENV.TWILIO_ACCOUNT_SID, env_js_1.ENV.TWILIO_AUTH_TOKEN);
            return twilioClient;
        }
        catch (err) {
            console.error('[Twilio] Failed to initialize client:', err);
            return null;
        }
    }
    return null;
}
async function sendSecuritySms(params) {
    const client = getTwilioClient();
    const body = `Simple IoT World Security Alert\n\nUnauthorized person detected.\n\nDevice: ${params.deviceName}\nTime: ${params.time}\nDate: ${params.date}\nDistance: ${params.distanceCm ?? 'N/A'} cm\n\nPlease check your security system.`;
    if (!client || !env_js_1.ENV.TWILIO_PHONE_NUMBER) {
        console.warn(`[Twilio SMS SIMULATION] (Missing credentials) Would send to ${params.to}:\n${body}`);
        return { success: true, sid: 'SIMULATED_SMS_SID_' + Date.now() };
    }
    try {
        const message = await client.messages.create({
            body,
            from: env_js_1.ENV.TWILIO_PHONE_NUMBER,
            to: params.to,
        });
        console.log(`[Twilio SMS] Sent successfully to ${params.to}, SID: ${message.sid}`);
        return { success: true, sid: message.sid };
    }
    catch (error) {
        console.error(`[Twilio SMS Error] Failed to send SMS to ${params.to}:`, error.message);
        return { success: false, error: error.message };
    }
}
async function makeSecurityVoiceCall(params) {
    const client = getTwilioClient();
    const twiml = `
    <Response>
      <Say voice="Polly.Aditi" language="en-IN">Security alert. An unauthorized person has been detected by your Simple IoT World security system. Please check immediately.</Say>
      <Pause length="1"/>
      <Say voice="Polly.Aditi" language="en-IN">Security alert. An unauthorized person has been detected by your Simple IoT World security system. Please check immediately.</Say>
    </Response>
  `;
    if (!client || !env_js_1.ENV.TWILIO_PHONE_NUMBER) {
        console.warn(`[Twilio Voice SIMULATION] (Missing credentials) Would call ${params.to}`);
        return { success: true, sid: 'SIMULATED_CALL_SID_' + Date.now() };
    }
    try {
        const call = await client.calls.create({
            twiml,
            to: params.to,
            from: env_js_1.ENV.TWILIO_PHONE_NUMBER,
        });
        console.log(`[Twilio Call] Initiated successfully to ${params.to}, SID: ${call.sid}`);
        return { success: true, sid: call.sid };
    }
    catch (error) {
        console.error(`[Twilio Call Error] Failed to make call to ${params.to}:`, error.message);
        return { success: false, error: error.message };
    }
}
