import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../services/supabaseService.js';
import { Device } from '../types/index.js';

export interface DeviceAuthenticatedRequest extends Request {
  device?: Device;
}

export async function requireDeviceAuth(
  req: DeviceAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const deviceId = (req.headers['x-device-id'] as string) || req.params.deviceId;
  const apiKey = (req.headers['x-device-key'] as string) || (req.headers['x-api-key'] as string);

  if (!deviceId) {
    res.status(400).json({ error: 'Device ID is required in headers (x-device-id) or URL parameters' });
    return;
  }

  const supabase = getSupabase();

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
      const match = await bcrypt.compare(apiKey, device.api_key_hash).catch(() => false);
      const directMatch = apiKey === device.api_key_hash; // In case plain text key was stored during development
      if (!match && !directMatch) {
        res.status(401).json({ error: 'Invalid device API key' });
        return;
      }
    }

    req.device = device as Device;
    next();
  } catch (err: any) {
    res.status(500).json({ error: 'Device authentication check failed: ' + err.message });
  }
}
