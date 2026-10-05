import twilio from 'twilio';
import { ENV } from '../config/env.js';

let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio | null {
  if (twilioClient) return twilioClient;

  if (ENV.TWILIO_ACCOUNT_SID && ENV.TWILIO_AUTH_TOKEN && !ENV.TWILIO_ACCOUNT_SID.startsWith('ACXXXXX')) {
    try {
      twilioClient = twilio(ENV.TWILIO_ACCOUNT_SID, ENV.TWILIO_AUTH_TOKEN);
      return twilioClient;
    } catch (err) {
      console.error('[Twilio] Failed to initialize client:', err);
      return null;
    }
  }
  return null;
}

export interface SendSmsParams {
  to: string;
  deviceName: string;
  time: string;
  date: string;
  distanceCm?: number | string;
}

export async function sendSecuritySms(params: SendSmsParams): Promise<{ success: boolean; sid?: string; error?: string }> {
  const client = getTwilioClient();
  const body = `Simple IoT World Security Alert\n\nUnauthorized person detected.\n\nDevice: ${params.deviceName}\nTime: ${params.time}\nDate: ${params.date}\nDistance: ${params.distanceCm ?? 'N/A'} cm\n\nPlease check your security system.`;

  if (!client || !ENV.TWILIO_PHONE_NUMBER) {
    console.warn(`[Twilio SMS SIMULATION] (Missing credentials) Would send to ${params.to}:\n${body}`);
    return { success: true, sid: 'SIMULATED_SMS_SID_' + Date.now() };
  }

  try {
    const message = await client.messages.create({
      body,
      from: ENV.TWILIO_PHONE_NUMBER,
      to: params.to,
    });
    console.log(`[Twilio SMS] Sent successfully to ${params.to}, SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error: any) {
    console.error(`[Twilio SMS Error] Failed to send SMS to ${params.to}:`, error.message);
    return { success: false, error: error.message };
  }
}

export interface VoiceCallParams {
  to: string;
}

export async function makeSecurityVoiceCall(params: VoiceCallParams): Promise<{ success: boolean; sid?: string; error?: string }> {
  const client = getTwilioClient();
  const twiml = `
    <Response>
      <Say voice="Polly.Aditi" language="en-IN">Security alert. An unauthorized person has been detected by your Simple IoT World security system. Please check immediately.</Say>
      <Pause length="1"/>
      <Say voice="Polly.Aditi" language="en-IN">Security alert. An unauthorized person has been detected by your Simple IoT World security system. Please check immediately.</Say>
    </Response>
  `;

  if (!client || !ENV.TWILIO_PHONE_NUMBER) {
    console.warn(`[Twilio Voice SIMULATION] (Missing credentials) Would call ${params.to}`);
    return { success: true, sid: 'SIMULATED_CALL_SID_' + Date.now() };
  }

  try {
    const call = await client.calls.create({
      twiml,
      to: params.to,
      from: ENV.TWILIO_PHONE_NUMBER,
    });
    console.log(`[Twilio Call] Initiated successfully to ${params.to}, SID: ${call.sid}`);
    return { success: true, sid: call.sid };
  } catch (error: any) {
    console.error(`[Twilio Call Error] Failed to make call to ${params.to}:`, error.message);
    return { success: false, error: error.message };
  }
}
