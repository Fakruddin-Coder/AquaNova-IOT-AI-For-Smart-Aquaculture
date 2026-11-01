import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Droplets,
  Brain,
  BarChart3,
  Bell,
  Camera,
  Cpu,
  FileText,
  Bot,
  Settings,
  LogOut,
  Waves,
  Menu,
  X,
  ChevronDown,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDevice } from '@/context/DeviceContext';
import { useMqtt } from '@/context/MqttContext';
import { cn } from '@/lib/utils';
import { getSensorStatus } from '@/lib/sensorMeta';
import { StatusDot } from '@/components/ui';
import { useFeederScheduler } from '@/hooks/useFeederScheduler';

const navItems = [
  { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/app/feeding', label: 'Feeding System', icon: Droplets },
  { path: '/app/ai', label: 'AI Intelligence', icon: Brain },
  { path: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/app/alerts', label: 'Alert Center', icon: Bell },
  { path: '/app/monitoring', label: 'Live Monitoring', icon: Camera },
  { path: '/app/devices', label: 'Devices', icon: Cpu },
  { path: '/app/reports', label: 'Reports', icon: FileText },
  { path: '/app/assistant', label: 'AI Assistant', icon: Bot },
  { path: '/app/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const { devices, activeDevice, setActiveDeviceId } = useDevice();
  const { mqttStatus, liveSensorData } = useMqtt();

  // Run automated feeding timer across all app pages
  useFeederScheduler();

  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) =>
    path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path);

  const liveAlertCount = liveSensorData
    ? [
        getSensorStatus(liveSensorData.temperature, 'temperature'),
        getSensorStatus(liveSensorData.ph, 'ph'),
        getSensorStatus(liveSensorData.waterLevel, 'water_level'),
        getSensorStatus(liveSensorData.dissolvedOxygen, 'dissolved_oxygen'),
        getSensorStatus(liveSensorData.turbidity, 'turbidity'),
      ].filter((status) => status !== 'normal').length
    : 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/30">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">AquaNova</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Device selector */}
        <div className="border-b border-slate-100 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Active Device</p>
          <div className="relative">
            <button
              onClick={() => setDeviceMenuOpen(!deviceMenuOpen)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
            >
              <div className="flex items-center gap-2">
                <StatusDot status={activeDevice?.status ?? 'offline'} />
                <span className="truncate text-sm font-medium text-slate-900">
                  {activeDevice?.name ?? 'No device'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
            {deviceMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {devices.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-500">No devices registered</p>
                )}
                {devices.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setActiveDeviceId(d.id);
                      setDeviceMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                      d.id === activeDevice?.id && 'bg-blue-50 text-blue-700'
                    )}
                  >
                    <StatusDot status={d.status} />
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-slate-100 p-4">
          <Link to="/app/settings" className="mb-3 flex items-center gap-3 rounded-xl p-1 -m-1 hover:bg-slate-50">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                (profile?.full_name ?? 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {profile?.full_name ?? 'User'}
              </p>
              <p className="truncate text-xs text-slate-500">Free Plan</p>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-slate-500">
              {navItems.find((n) => isActive(n.path))?.label ?? 'Dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* MQTT Connection Status Indicator */}
            <MqttStatusPill status={mqttStatus} />
            <Link
              to="/app/alerts"
              className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
              title={liveAlertCount ? `${liveAlertCount} active sensor alert${liveAlertCount === 1 ? '' : 's'}` : 'No active sensor alerts'}
            >
              <Bell className="h-5 w-5" />
              {liveAlertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {liveAlertCount}
                </span>
              )}
            </Link>
            <Link
              to="/app/assistant"
              className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Ask AquaBot</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── MQTT Status Pill ──────────────────────────────────────────────────────────

import type { MqttConnectionStatus } from '@/services/mqtt';

function MqttStatusPill({ status }: { status: MqttConnectionStatus }) {
  const config: Record<
    MqttConnectionStatus,
    { icon: React.ReactNode; label: string; cls: string; dotCls: string }
  > = {
    connected: {
      icon: <Wifi className="h-3 w-3" />,
      label: 'MQTT',
      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      dotCls: 'bg-emerald-500',
    },
    connecting: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Connecting',
      cls: 'bg-blue-50 text-blue-700 border border-blue-200',
      dotCls: 'bg-blue-400',
    },
    reconnecting: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Reconnecting',
      cls: 'bg-amber-50 text-amber-700 border border-amber-200',
      dotCls: 'bg-amber-400 animate-pulse',
    },
    disconnected: {
      icon: <WifiOff className="h-3 w-3" />,
      label: 'MQTT Offline',
      cls: 'bg-slate-100 text-slate-500 border border-slate-200',
      dotCls: 'bg-slate-400',
    },
    error: {
      icon: <WifiOff className="h-3 w-3" />,
      label: 'MQTT Error',
      cls: 'bg-red-50 text-red-600 border border-red-200',
      dotCls: 'bg-red-500',
    },
  };

  const { icon, label, cls, dotCls } = config[status];

  return (
    <div
      className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}
      title={`MQTT broker: ${status}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {icon}
      <span>{label}</span>
    </div>
  );
}
