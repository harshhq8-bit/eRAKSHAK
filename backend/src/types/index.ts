export type RecognitionResult = 'AUTHORIZED' | 'UNAUTHORIZED' | 'UNKNOWN';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING';
export type LedState = 'ON' | 'OFF';
export type CommandType = 'LCD' | 'LED' | 'AUTHORIZED' | 'UNAUTHORIZED' | 'RESET';
export type CameraStatus = 'READY' | 'NOT_READY';
export type RecognitionStatus = 'READY' | 'BUSY' | 'OFFLINE';

export interface Device {
  id: string;
  owner_id: string;
  device_name: string;
  device_uid: string;
  api_key_hash: string;
  wifi_ssid?: string;
  local_ip?: string;
  status: DeviceStatus;
  last_seen?: string;
  created_at: string;
}

export interface SensorReading {
  id: string;
  device_id: string;
  pir_detected: boolean;
  distance_cm?: number;
  created_at: string;
}

export interface AccessEvent {
  id: string;
  device_id: string;
  user_id?: string | null;
  face_name?: string | null;
  recognition_result: RecognitionResult;
  confidence?: number | null;
  distance_cm?: number | null;
  event_type: string;
  notification_status?: string;
  created_at: string;
}

export interface LcdCommand {
  id: string;
  device_id: string;
  line1: string;
  line2: string;
  processed: boolean;
  created_at: string;
}

export interface LedCommand {
  id: string;
  device_id: string;
  state: LedState;
  processed: boolean;
  created_at: string;
}

export interface DeviceCommand {
  id: string;
  device_id: string;
  command_type: CommandType;
  payload: Record<string, any>;
  processed: boolean;
  created_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  sms_enabled: boolean;
  email_enabled: boolean;
  call_enabled: boolean;
  phone_number?: string;
  email_address?: string;
  cooldown_seconds: number;
  created_at: string;
}

export interface MobileDevice {
  id: string;
  owner_id: string;
  device_name: string;
  pairing_code: string;
  online: boolean;
  camera_status: CameraStatus;
  recognition_status: RecognitionStatus;
  last_seen?: string;
  created_at: string;
}

export interface SystemLog {
  id: string;
  user_id?: string | null;
  device_id?: string | null;
  event: string;
  metadata?: Record<string, any>;
  created_at: string;
}
