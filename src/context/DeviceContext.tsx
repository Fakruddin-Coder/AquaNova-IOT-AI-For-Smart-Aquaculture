import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/services/api';
import { useAuth } from './AuthContext';
import type { Device } from '@/types';

interface DeviceContextValue {
  devices: Device[];
  activeDevice: Device | null;
  loading: boolean;
  setActiveDeviceId: (id: string) => void;
  refresh: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextValue | undefined>(undefined);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setDevices([]);
      setLoading(false);
      return;
    }

    const rawDevices = await api.getDevices();

    let deviceList: Device[] = (rawDevices || []).map((d: any) => ({
      id: d._id || d.id || d.deviceId,
      user_id: d.userId || user.id,
      device_id: d.deviceId || 'AN-001',
      name: d.deviceName || d.name || 'AquaNova Main Tank Kit',
      status: d.status || 'online',
      firmware_version: d.firmwareVersion || d.firmware_version || '1.2.4',
      installed_at: d.createdAt || new Date().toISOString(),
      last_data_at: d.lastSeen || d.last_data_at || new Date().toISOString(),
      wifi_signal: d.wifiSignal ?? 85,
      uptime_seconds: d.uptimeSeconds ?? 86400,
      created_at: d.createdAt || new Date().toISOString(),
    }));

    setDevices(deviceList);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const activeDevice = devices.find((d) => d.id === activeDeviceId || d.device_id === activeDeviceId) ?? devices[0] ?? null;

  return (
    <DeviceContext.Provider
      value={{
        devices,
        activeDevice,
        loading,
        setActiveDeviceId,
        refresh: load,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
}
