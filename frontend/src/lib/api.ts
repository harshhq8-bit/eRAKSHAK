import { supabase } from './supabase.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// Format timestamp to Asia/Kolkata (Date: DD-MM-YYYY, Time: HH:MM AM/PM)
export function formatKolkataDateTime(isoString?: string | null): { date: string; time: string; full: string } {
  if (!isoString) return { date: '--', time: '--', full: '--' };

  try {
    const d = new Date(isoString);
    const dateStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d).replace(/\//g, '-');

    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    return { date: dateStr, time: timeStr, full: `${dateStr} ${timeStr}` };
  } catch {
    return { date: '--', time: '--', full: '--' };
  }
}

export const api = {
  // Devices
  async getDevices() {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/devices`, { headers });
    return res.json();
  },

  async registerDevice(data: { device_name: string; device_uid: string; api_key?: string; wifi_ssid?: string }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/devices/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getDeviceStatus(deviceId: string) {
    const res = await fetch(`${API_BASE}/api/devices/${deviceId}/status`);
    return res.json();
  },

  async setLcd(deviceId: string, line1: string, line2: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/devices/${deviceId}/lcd`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ line1, line2 }),
    });
    return res.json();
  },

  async setLed(deviceId: string, state: 'ON' | 'OFF') {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/devices/${deviceId}/led`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ state }),
    });
    return res.json();
  },

  async resetDevice(deviceId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/devices/${deviceId}/reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return res.json();
  },

  // Mobile Pairing & Status
  async generatePairingCode(deviceId: string, deviceName?: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/mobile/generate-code`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ device_id: deviceId, device_name: deviceName }),
    });
    return res.json();
  },

  async pairMobile(pairingCode: string, deviceName?: string) {
    const res = await fetch(`${API_BASE}/api/mobile/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingCode, deviceName }),
    });
    return res.json();
  },

  async sendMobileHeartbeat(data: { mobileId?: string; pairingCode?: string; cameraStatus: string; recognitionStatus: string }) {
    const res = await fetch(`${API_BASE}/api/mobile/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getMobileStatus(deviceId: string) {
    const res = await fetch(`${API_BASE}/api/mobile/${deviceId}/status`);
    return res.json();
  },

  async reportFaceResult(deviceId: string, data: { result: 'AUTHORIZED' | 'UNAUTHORIZED' | 'UNKNOWN'; personName?: string; confidence?: number; distanceCm?: number }) {
    const res = await fetch(`${API_BASE}/api/mobile/${deviceId}/face-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Notifications
  async getNotificationSettings() {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/notifications/settings`, { headers });
    return res.json();
  },

  async updateNotificationSettings(settings: any) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/notifications/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async testSms(to?: string, deviceName?: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/notifications/sms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to, deviceName }),
    });
    return res.json();
  },

  async testEmail(to?: string, deviceName?: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/notifications/email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to, deviceName }),
    });
    return res.json();
  },

  async testCall(to?: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/notifications/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to }),
    });
    return res.json();
  },

  // Events & History
  async getEvents(page = 1, pageSize = 10, deviceId?: string) {
    const headers = await getAuthHeaders();
    let url = `${API_BASE}/api/events?page=${page}&pageSize=${pageSize}`;
    if (deviceId) url += `&deviceId=${deviceId}`;
    const res = await fetch(url, { headers });
    return res.json();
  },

  async deleteEvent(eventId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/events/${eventId}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },
};
