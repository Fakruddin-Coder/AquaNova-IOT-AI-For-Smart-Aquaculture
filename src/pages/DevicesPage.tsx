import { useState } from 'react';
import { Cpu, Plus, Wifi, Activity, Clock, Trash2, X } from 'lucide-react';
import { useDevice } from '@/context/DeviceContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardBody, Badge, Button, Spinner, EmptyState, StatusDot } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { api } from '@/services/api';
import { uptimeString, timeAgo, formatDate } from '@/lib/utils';
import type { Device } from '@/types';

export default function DevicesPage() {
  const { devices, activeDevice, setActiveDeviceId, loading, refresh } = useDevice();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [fishCount, setFishCount] = useState('25');
  const [adding, setAdding] = useState(false);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Get fish counts map from localStorage
  const getFishCounts = (): Record<string, number> => {
    try {
      const saved = localStorage.getItem('aquanova_fish_counts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const fishCounts = getFishCounts();

  const handleAdd = async () => {
    if (!user || !deviceId || !deviceName) return;
    setAdding(true);
    await api.createDevice({
      deviceId,
      deviceName,
    });

    // Save initial fish count for new device
    try {
      const countNum = parseInt(fishCount, 10) || 25;
      const current = getFishCounts();
      current[deviceId] = countNum;
      localStorage.setItem('aquanova_fish_counts', JSON.stringify(current));
    } catch (e) {
      console.error(e);
    }

    setAdding(false);
    setShowAdd(false);
    setDeviceId('');
    setDeviceName('');
    setFishCount('25');
    refresh();
  };

  const handleDelete = async (device: Device) => {
    const targetId = device.device_id || device.id;
    if (!window.confirm(`Are you sure you want to delete device "${device.name}" (${targetId})? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteDevice(targetId);
      // Clean up local fish count cache
      try {
        const current = getFishCounts();
        delete current[device.device_id];
        delete current[device.id];
        localStorage.setItem('aquanova_fish_counts', JSON.stringify(current));
      } catch (e) {}
      await refresh();
    } catch (err: any) {
      console.error('Delete device error:', err);
      alert(err.message || 'Failed to delete device. Please try again.');
    }
  };

  return (
    <>
      <PageHeader
        title="Devices"
        subtitle="Manage your AquaNova IoT kits"
        action={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Register Device
          </Button>
        }
      />


      {/* Add device modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowAdd(false)}>
          <Card className="w-full max-w-md animate-scale-in">
            <div onClick={(e) => e.stopPropagation()}>
              <CardHeader
                title="Register New Device"
                subtitle="Connect a new AquaNova IoT kit"
                icon={<Cpu className="h-5 w-5" />}
                action={
                  <button onClick={() => setShowAdd(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                    <X className="h-5 w-5" />
                  </button>
                }
              />
              <CardBody className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Device ID</label>
                  <input
                    placeholder="e.g. AQN-AB12CD34"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-xs text-slate-400">Found on the bottom of your AquaNova kit</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Device Name</label>
                  <input
                    placeholder="e.g. Tank C — Breeding"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Initial Fish Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 25"
                    value={fishCount}
                    onChange={(e) => setFishCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button onClick={handleAdd} disabled={adding || !deviceId || !deviceName}>
                    {adding ? 'Registering...' : 'Register Device'}
                  </Button>
                </div>
              </CardBody>
            </div>
          </Card>
        </div>
      )}

      {/* Device cards */}
      {devices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Cpu className="h-12 w-12" />}
            title="No devices registered"
            message="Register your first AquaNova IoT kit to start monitoring."
          />
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {devices.map((device) => {
            const devId = device.device_id || device.id;
            const count = fishCounts[devId] ?? fishCounts[device.id] ?? 25;
            return (
              <Card
                key={device.id}
                className={device.id === activeDevice?.id ? 'ring-2 ring-blue-500' : ''}
              >
                <CardHeader
                  title={device.name}
                  subtitle={device.device_id}
                  icon={<Cpu className="h-5 w-5" />}
                  action={
                    <Badge variant={device.status === 'online' ? 'success' : 'default'}>
                      <StatusDot status={device.status} />
                      {device.status}
                    </Badge>
                  }
                />
                <CardBody>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Wifi className="h-3.5 w-3.5" /> WiFi Signal
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{device.wifi_signal}%</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" /> Uptime
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{uptimeString(device.uptime_seconds)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Activity className="h-3.5 w-3.5" /> Firmware
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">v{device.firmware_version}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" /> Fish Population
                      </div>
                      <p className="mt-1 text-sm font-semibold text-blue-600">{count} fish</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Installed {formatDate(device.installed_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      {device.id !== activeDevice?.id && (
                        <Button variant="secondary" size="sm" onClick={() => setActiveDeviceId(device.id)}>
                          Set Active
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(device)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
