"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSecurityEmail = sendSecurityEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const env_js_1 = require("../config/env.js");
let gmailTransporter = null;
if (env_js_1.ENV.GMAIL_USER && env_js_1.ENV.GMAIL_APP_PASSWORD) {
    gmailTransporter = nodemailer_1.default.createTransport({
        service: 'gmail',
        auth: {
            user: env_js_1.ENV.GMAIL_USER,
            pass: env_js_1.ENV.GMAIL_APP_PASSWORD,
        },
    });
    console.log(`[EmailService] Gmail SMTP transport initialized for ${env_js_1.ENV.GMAIL_USER}`);
}
let sendgridConfigured = false;
if (env_js_1.ENV.SENDGRID_API_KEY && env_js_1.ENV.SENDGRID_API_KEY.startsWith('SG.')) {
    mail_1.default.setApiKey(env_js_1.ENV.SENDGRID_API_KEY);
    sendgridConfigured = true;
}
async function sendSecurityEmail(params) {
    const subject = '🚨 Security Alert - Unauthorized Access Detected [eRAKSHAK]';
    const text = `Simple IoT World - eRAKSHAK Security Alert\n\nUnauthorized person detected!\n\nDevice: ${params.deviceName}\nTime: ${params.time}\nDate: ${params.date}\nDistance: ${params.distanceCm ?? 'N/A'} cm\nRecognition: UNAUTHORIZED\n\nDeveloped by Justice League, Dept of ETC, SBJAIN\nPlease check the security system dashboard: ${env_js_1.ENV.FRONTEND_URL}`;
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fecdd3; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #b91c1c, #ef4444); color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">🚨 Simple IoT World</h1>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95; font-weight: 500;">High-Priority eRAKSHAK Security Alert</p>
      </div>
      <div style="padding: 28px; background-color: #ffffff; color: #1e293b;">
        <div style="display: inline-block; background-color: #fee2e2; color: #b91c1c; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; margin-bottom: 12px;">
          CRITICAL INTRUSION DETECTED
        </div>
        <h2 style="color: #dc2626; margin: 0 0 16px; font-size: 20px;">Unauthorized Person Detected</h2>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px;">
          The system's AI camera companion identified an unrecognized face or perimeter intrusion at the monitored entrance.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; width: 35%;">Monitored Device:</td>
            <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${params.deviceName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Time (IST):</td>
            <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${params.time}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Date:</td>
            <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${params.date}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Ultrasonic Range:</td>
            <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${params.distanceCm ?? 'N/A'} cm</td>
          </tr>
          <tr style="background-color: #fef2f2;">
            <td style="padding: 10px 12px; font-weight: 600; color: #991b1b; border-bottom: 1px solid #fecdd3;">Security Status:</td>
            <td style="padding: 10px 12px; color: #dc2626; font-weight: 800; border-bottom: 1px solid #fecdd3; letter-spacing: 0.5px;">UNAUTHORIZED</td>
          </tr>
        </table>
        
        <div style="margin-top: 24px; text-align: center;">
          <a href="${env_js_1.ENV.FRONTEND_URL}" style="display: inline-block; background: linear-gradient(135deg, #dc2626, #b91c1c); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);">
            Open Security Dashboard
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px; text-align: center; color: #64748b; font-size: 12px;">
        <p style="margin: 0; font-weight: 500;">eRAKSHAK Smart Security System</p>
        <p style="margin: 4px 0 0; color: #94a3b8;">Developed by Justice League &bull; Dept of ETC, SBJAIN</p>
      </div>
    </div>
  `;
    // 1. Send via Gmail SMTP if configured
    if (gmailTransporter && env_js_1.ENV.GMAIL_USER) {
        try {
            const info = await gmailTransporter.sendMail({
                from: `"eRAKSHAK Security Alerts" <${env_js_1.ENV.GMAIL_USER}>`,
                to: params.to,
                subject,
                text,
                html,
            });
            console.log(`[Gmail Email] Alert successfully sent to ${params.to} (MessageId: ${info.messageId})`);
            return { success: true, messageId: info.messageId };
        }
        catch (error) {
            console.error(`[Gmail Email Error] Failed to send email to ${params.to}:`, error.message);
            return { success: false, error: error.message };
        }
    }
    // 2. Send via SendGrid if configured
    if (sendgridConfigured) {
        try {
            await mail_1.default.send({
                to: params.to,
                from: env_js_1.ENV.SENDGRID_FROM_EMAIL,
                subject,
                text,
                html,
            });
            console.log(`[SendGrid Email] Alert successfully sent to ${params.to}`);
            return { success: true };
        }
        catch (error) {
            console.error(`[SendGrid Email Error] Failed to send email to ${params.to}:`, error.message);
            return { success: false, error: error.message };
        }
    }
    // 3. Fallback simulation
    console.warn(`[Email SIMULATION] (No credentials configured) Would send to ${params.to}:\n${text}`);
    return { success: true };
}
