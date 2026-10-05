import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { Device, AccessEvent } from '../types/index.js';

interface DeviceContextType {
  devices: Device[];
  currentDevice: Device | null;
  setCurrentDevice: (device: Device) => void;
  espStatus: 'ONLINE' | 'OFFLINE' | 'CONNECTING';
  mobileStatus: {
    online: boolean;
    camera: 'READY' | 'NOT_READY';
    recognition: 'READY' | 'BUSY' | 'OFFLINE';
    lastSeen?: string;
  };
  latestSensor: {
    pirDetected: boolean;
    distanceCm: number;
    timestamp: string;
  };
  latestEvent: AccessEvent | null;
  ledState: 'ON' | 'OFF';
  lcdState: {
    line1: string;
    line2: string;
    lastUpdated?: string;
  };
  unauthorizedAlert: AccessEvent | null;
  dismissAlert: () => void;
  refreshDeviceData: () => Promise<void>;
  registerNewDevice: (name: string, uid: string) => Promise<boolean>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// Default fallback device for demo & initial testing
const defaultFallbackDevice: Device = {
  id: 'erakshak-nodemcu-01',
  owner_id: 'demo-user-id-01',
  device_name: 'eRAKSHAK Main Gate',
  device_uid: 'ESP8266-CP2102-01',
  wifi_ssid: 'ESP8266',
  local_ip: '192.168.65.77',
  status: 'ONLINE',
  last_seen: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([defaultFallbackDevice]);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(defaultFallbackDevice);
  const [espStatus, setEspStatus] = useState<'ONLINE' | 'OFFLINE' | 'CONNECTING'>('ONLINE');
  const [mobileStatus, setMobileStatus] = useState<{
    online: boolean;
    camera: 'READY' | 'NOT_READY';
    recognition: 'READY' | 'BUSY' | 'OFFLINE';
    lastSeen?: string;
  }>({
    online: false,
    camera: 'NOT_READY',
    recognition: 'OFFLINE',
  });

  const [latestSensor, setLatestSensor] = useState<{
    pirDetected: boolean;
    distanceCm: number;
    timestamp: string;
  }>({
    pirDetected: false,
    distanceCm: 45,
    timestamp: new Date().toISOString(),
  });

  const [latestEvent, setLatestEvent] = useState<AccessEvent | null>(null);
  const [unauthorizedAlert, setUnauthorizedAlert] = useState<AccessEvent | null>(null);
  const [ledState, setLedState] = useState<'ON' | 'OFF'>('OFF');
  const [lcdState, setLcdState] = useState<{ line1: string; line2: string; lastUpdated?: string }>({
    line1: 'SYSTEM READY',
    line2: 'WAITING...',
    lastUpdated: new Date().toISOString(),
  });

  const refreshDeviceData = useCallback(async () => {
    if (!currentDevice) return;

    try {
      // 1. Fetch hardware status from backend
      const data = await api.getDeviceStatus(currentDevice.id);
      if (data?.device) {
        setEspStatus(data.device.status as 'ONLINE' | 'OFFLINE');
        if (data.latestSensor) {
          setLatestSensor({
            pirDetected: Boolean(data.latestSensor.pir_detected),
            distanceCm: data.latestSensor.distance_cm || 0,
            timestamp: data.latestSensor.created_at,
          });
        }
        if (data.latestEvent) {
          setLatestEvent(data.latestEvent);
          if (
            (data.latestEvent.recognition_result === 'UNAUTHORIZED' ||
              data.latestEvent.recognition_result === 'UNKNOWN') &&
            (!unauthorizedAlert || unauthorizedAlert.id !== data.latestEvent.id)
          ) {
            setUnauthorizedAlert(data.latestEvent);
          }
        }
      }

      // 2. Fetch mobile status
      const mobData = await api.getMobileStatus(currentDevice.id);
      if (mobData?.mobile) {
        setMobileStatus({
          online: Boolean(mobData.mobile.online),
          camera: mobData.mobile.camera_status || 'NOT_READY',
          recognition: mobData.mobile.recognition_status || 'OFFLINE',
          lastSeen: mobData.mobile.last_seen,
        });
      }
    } catch {
      // Keep optimistic state if network/backend is restarting
    }
  }, [currentDevice, unauthorizedAlert]);

  // Initial load and periodic polling
  useEffect(() => {
    refreshDeviceData();
    const interval = setInterval(refreshDeviceData, 5000);
    return () => clearInterval(interval);
  }, [refreshDeviceData]);

  // Realtime Supabase Subscriptions
  useEffect(() => {
    if (!currentDevice) return;

    const channel = supabase
      .channel('erakshak-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'access_events' },
        (payload) => {
          const newEv = payload.new as AccessEvent;
          if (newEv && newEv.device_id === currentDevice.id) {
            setLatestEvent(newEv);
            if (newEv.recognition_result === 'UNAUTHORIZED' || newEv.recognition_result === 'UNKNOWN') {
              setUnauthorizedAlert(newEv);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          const newReading = payload.new as any;
          if (newReading && newReading.device_id === currentDevice.id) {
            setLatestSensor({
              pirDetected: Boolean(newReading.pir_detected),
              distanceCm: newReading.distance_cm || 0,
              timestamp: newReading.created_at,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'led_commands' },
        (payload) => {
          const cmd = payload.new as any;
          if (cmd && cmd.device_id === currentDevice.id) {
            setLedState(cmd.state);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lcd_commands' },
        (payload) => {
          const cmd = payload.new as any;
          if (cmd && cmd.device_id === currentDevice.id) {
            setLcdState({
              line1: cmd.line1,
              line2: cmd.line2,
              lastUpdated: cmd.created_at,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mobile_devices' },
        (payload) => {
          const mob = payload.new as any;
          if (mob) {
            setMobileStatus({
              online: Boolean(mob.online),
              camera: mob.camera_status,
              recognition: mob.recognition_status,
              lastSeen: mob.last_seen,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDevice]);

  const dismissAlert = () => {
    setUnauthorizedAlert(null);
  };

  const registerNewDevice = async (name: string, uid: string) => {
    try {
      const res = await api.registerDevice({
        device_name: name,
        device_uid: uid,
      });
      if (res?.device) {
        setDevices((prev) => [res.device, ...prev]);
        setCurrentDevice(res.device);
        return true;
      }
    } catch {
      // Fallback local addition
      const newDev: Device = {
        id: uid.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        owner_id: 'user',
        device_name: name,
        device_uid: uid,
        wifi_ssid: 'ESP8266',
        status: 'ONLINE',
        created_at: new Date().toISOString(),
      };
      setDevices((prev) => [newDev, ...prev]);
      setCurrentDevice(newDev);
      return true;
    }
    return false;
  };

  return (
    <DeviceContext.Provider
      value={{
        devices,
        currentDevice,
        setCurrentDevice,
        espStatus,
        mobileStatus,
        latestSensor,
        latestEvent,
        ledState,
        lcdState,
        unauthorizedAlert,
        dismissAlert,
        refreshDeviceData,
        registerNewDevice,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};
