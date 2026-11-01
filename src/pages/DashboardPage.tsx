import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Bell,
  Fish,
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Bot,
  Thermometer,
  Gauge,
  Waves,
  Eye,
  Droplets,
  WifiOff,
} from 'lucide-react';
import { useDeviceData } from '@/hooks/useDeviceData';
import { useAiData } from '@/hooks/useAiData';
import { useDevice } from '@/context/DeviceContext';
import { useMqtt } from '@/context/MqttContext';
import { getSensorStatus } from '@/lib/sensorMeta';
import { Card, CardHeader, CardBody, Badge, StatusDot, ProgressBar, Spinner, EmptyState } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { timeAgo } from '@/lib/utils';
import { SystemStatusCard } from '@/components/dashboard/SystemStatusCard';
import { FishPopulationCard } from '@/components/dashboard/FishPopulationCard';
import type { MqttSensorPayload } from '@/services/mqtt';

// ── Sensor card definitions ───────────────────────────────────────────────────
// Each entry maps directly to an MQTT payload field.

interface SensorCardDef {
  key:     keyof MqttSensorPayload;
  label:   string;
  name:    string;
  unit:    string;
  type:    string;           // matches getSensorStatus / sensorMeta key
  icon:    React.ReactNode;
  bgColor: string;
  color:   string;
  optimal: [number, number];
  warning: [number, number];
  format:  (v: number) => string;
}

const SENSOR_CARDS: SensorCardDef[] = [
  {
    key:     'temperature',
    label:   'Water Temperature',
    name:    'Temp Sensor',
    unit:    '°C',
    type:    'temperature',
    icon:    <Thermometer className="h-5 w-5" />,
    bgColor: 'bg-orange-50',
    color:   'text-orange-600',
    optimal: [24, 28],
    warning: [20, 32],
    format:  (v) => `${v.toFixed(1)}°C`,
  },
  {
    key:     'ph',
    label:   'pH Level',
    name:    'pH Sensor',
    unit:    '',
    type:    'ph',
    icon:    <Gauge className="h-5 w-5" />,
    bgColor: 'bg-blue-50',
    color:   'text-blue-600',
    optimal: [6.5, 8.5],
    warning: [6, 9],
    format:  (v) => v.toFixed(2),
  },
  {
    key:     'waterLevel',
    label:   'Water Level',
    name:    'Level Sensor',
    unit:    '%',
    type:    'water_level',
    icon:    <Waves className="h-5 w-5" />,
    bgColor: 'bg-cyan-50',
    color:   'text-cyan-600',
    optimal: [70, 95],
    warning: [50, 100],
    format:  (v) => `${v.toFixed(0)}%`,
  },
  {
    key:     'dissolvedOxygen',
    label:   'Dissolved Oxygen',
    name:    'DO Sensor',
    unit:    'mg/L',
    type:    'dissolved_oxygen',
    icon:    <Fish className="h-5 w-5" />,
    bgColor: 'bg-indigo-50',
    color:   'text-indigo-600',
    optimal: [6, 10],
    warning: [4, 12],
    format:  (v) => `${v.toFixed(1)} mg/L`,
  },
  {
    key:     'turbidity',
    label:   'Turbidity',
    name:    'Turbidity Sensor',
    unit:    'NTU',
    type:    'turbidity',
    icon:    <Eye className="h-5 w-5" />,
    bgColor: 'bg-amber-50',
    color:   'text-amber-600',
    optimal: [0, 5],
    warning: [0, 10],
    format:  (v) => `${v.toFixed(1)} NTU`,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeDevice } = useDevice();
  const activeDeviceId  = activeDevice?.id || activeDevice?.device_id || 'AN-001';
  const activeDeviceName = activeDevice?.name || 'Main Tank';

  // REST data (alerts, feeding)
  const { alerts, loading: deviceLoading } = useDeviceData();

  // Live MQTT + fallback sensor data
  const { activeSensorData, isUsingMockData, mqttStatus } = useMqtt();

  // AI data — always driven by whatever sensor data is currently active
  const { predictions, recommendations, loading: aiLoading } = useAiData(activeSensorData);

  const loading = deviceLoading || aiLoading;

  // Fish population (localStorage per device)
  const [fishCounts, setFishCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('aquanova_fish_counts');
      return saved ? JSON.parse(saved) : { 'AN-001': 25 };
    } catch {
      return { 'AN-001': 25 };
    }
  });

  const currentFishCount = fishCounts[activeDeviceId] ?? 25;

  const handleIncrementFish = () => {
    setFishCounts((prev) => {
      const updated = { ...prev, [activeDeviceId]: (prev[activeDeviceId] ?? 25) + 1 };
      try { localStorage.setItem('aquanova_fish_counts', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDecrementFish = () => {
    setFishCounts((prev) => {
      const cur = prev[activeDeviceId] ?? 25;
      if (cur <= 0) return prev;
      const updated = { ...prev, [activeDeviceId]: cur - 1 };
      try { localStorage.setItem('aquanova_fish_counts', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!activeDevice) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Real-time overview of your aquaculture system" />
        <Card>
          <EmptyState
            icon={<Activity className="h-12 w-12" />}
            title="No devices found"
            message="Register an AquaNova IoT kit to start monitoring your tanks."
          />
        </Card>
      </>
    );
  }

  const activeAlerts = alerts.filter((a) => !a.resolved);

  const healthPrediction = predictions.find(
    (p) => p.model_type === 'health_score' || p.model_type === 'Aquaculture Health Predictor'
  );
  const hasPrediction =
    healthPrediction &&
    healthPrediction.health_score !== null &&
    healthPrediction.health_score !== undefined &&
    healthPrediction.health_score > 0;

  const healthScore = hasPrediction ? healthPrediction.health_score! : 0;
  const topRec = recommendations[0];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of your aquaculture system"
        action={
          <Link to="/app/assistant">
            <button className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100">
              <Bot className="h-4 w-4" />
              Ask AquaBot
            </button>
          </Link>
        }
      />


      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="System Health"
          value={hasPrediction ? `${healthScore}/100` : 'Initializing'}
          trend={hasPrediction && healthScore >= 80 ? 'up' : 'down'}
          trendValue={hasPrediction ? (healthScore >= 80 ? 'Optimal' : 'Needs attention') : 'Awaiting data'}
          color="emerald"
        />
        <StatCard
          icon={<Bell className="h-5 w-5" />}
          label="Active Alerts"
          value={activeAlerts.length.toString()}
          trend={activeAlerts.length > 0 ? 'down' : 'up'}
          trendValue={activeAlerts.length > 0 ? 'Needs attention' : 'All clear'}
          color={activeAlerts.length > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          icon={<Fish className="h-5 w-5" />}
          label="Fish Population"
          value={currentFishCount.toString()}
          trend="up"
          trendValue={`${Math.round((currentFishCount / 50) * 100)}% occupancy`}
          color="blue"
        />
        <StatCard
          icon={<Brain className="h-5 w-5" />}
          label="AI Predictions"
          value={predictions.length.toString()}
          trend="up"
          trendValue="Models running"
          color="indigo"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── Water Quality Sensors ─────────────────────────────────────── */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Water Quality Sensors</h3>
            <div className="grid gap-4 sm:grid-cols-2">

              {/* No sensor data — only shown if somehow activeSensorData is null */}
              {!activeSensorData && (
                <div className="col-span-2">
                  <Card>
                    <CardBody>
                      <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                          <WifiOff className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {mqttStatus === 'connected'
                              ? 'Waiting for first sensor reading…'
                              : mqttStatus === 'connecting' || mqttStatus === 'reconnecting'
                              ? 'Connecting to MQTT broker…'
                              : 'MQTT broker unreachable'}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Sensor values will appear here once the ESP32 publishes to{' '}
                            <code className="rounded bg-slate-100 px-1">aquanova/sensors</code>
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}

              {activeSensorData && (
                <>
                  {SENSOR_CARDS.map((def) => {
                    const value  = activeSensorData[def.key as keyof MqttSensorPayload] as number;
                    const status = getSensorStatus(value, def.type);
                    const statusLabel =
                      status === 'normal' ? 'Normal' : status === 'warning' ? 'Warning' : 'Critical';

                    return (
                      <Card key={def.key} className="h-[244px] overflow-hidden">
                        <CardBody className="flex h-full flex-col justify-center">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${def.bgColor}`}>
                                <span className={def.color}>{def.icon}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{def.label}</p>
                                <p className="text-xs text-slate-500">{def.name}</p>
                              </div>
                            </div>
                            <Badge variant={status === 'normal' ? 'success' : status === 'warning' ? 'warning' : 'danger'}>
                              <StatusDot status={status === 'normal' ? 'online' : status === 'warning' ? 'warning' : 'critical'} />
                              {statusLabel}
                            </Badge>
                          </div>

                          <div className="mt-4 flex items-end justify-between">
                            <p className="text-3xl font-bold text-slate-900 tabular-nums">
                              {def.format(value)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {isUsingMockData ? 'Demo Data' : 'Live · MQTT'}
                            </p>
                          </div>

                          <div className="mt-6 w-full">
                            <ProgressBar
                              value={value}
                              max={def.warning[1]}
                              color={status === 'normal' ? 'blue' : status === 'warning' ? 'amber' : 'red'}
                            />
                            <div className="mt-1.5 flex justify-between text-xs text-slate-400">
                              <span>{def.warning[0]}</span>
                              <span>Optimal: {def.optimal[0]}–{def.optimal[1]}</span>
                              <span>{def.warning[1]}</span>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                  <SystemStatusCard />
                </>
              )}
            </div>
          </div>

          {/* Fish Population Control */}
          <FishPopulationCard
            deviceName={activeDeviceName}
            count={currentFishCount}
            capacity={50}
            onIncrement={handleIncrementFish}
            onDecrement={handleDecrementFish}
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* AI Health Score */}
          <Card>
            <CardHeader
              title="AI Health Score"
              subtitle="Predicted by ML model"
              icon={<Sparkles className="h-5 w-5" />}
            />
            <CardBody>
              {hasPrediction ? (
                <div className="flex flex-col items-center">
                  <div className="relative flex h-32 w-32 items-center justify-center">
                    <svg className="h-32 w-32 -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(healthScore / 100) * 351.86} 351.86`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <p className="text-3xl font-bold text-slate-900">{healthScore}</p>
                      <p className="text-xs text-slate-500">out of 100</p>
                    </div>
                  </div>
                  <Badge variant={healthScore >= 80 ? 'success' : 'warning'} className="mt-3">
                    {healthScore >= 80 ? 'Healthy' : 'Needs Attention'}
                  </Badge>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
                    <Brain className="h-6 w-6 animate-pulse text-blue-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Waiting for sensor data</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-[200px]">
                    ML model will calculate health score once data is initialized.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Top Recommendation */}
          {topRec && (
            <Card>
              <CardHeader title="AI Recommendation" subtitle="Smart insight" icon={<Brain className="h-5 w-5" />} />
              <CardBody>
                <div className={`rounded-xl p-4 ${topRec.level === 'healthy' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <div className="flex items-start gap-3">
                    {topRec.level === 'healthy' ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                    )}
                    <p className="text-sm text-slate-700">{topRec.message}</p>
                  </div>
                </div>
                <Link
                  to="/app/ai"
                  className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View all insights <ArrowRight className="h-4 w-4" />
                </Link>
              </CardBody>
            </Card>
          )}

          {/* Recent Alerts */}
          <Card>
            <CardHeader
              title="Recent Alerts"
              subtitle={`${activeAlerts.length} active`}
              icon={<Bell className="h-5 w-5" />}
              action={
                <Link to="/app/alerts" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  View all
                </Link>
              }
            />
            <CardBody className="space-y-3">
              {alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 text-red-600'
                        : alert.severity === 'warning'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {alert.severity === 'info' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                    <p className="truncate text-xs text-slate-500">{alert.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{timeAgo(alert.created_at)}</p>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">No alerts</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  trend,
  trendValue,
  color,
}: {
  icon:       React.ReactNode;
  label:      string;
  value:      string;
  trend:      'up' | 'down';
  trendValue: string;
  color:      'blue' | 'emerald' | 'amber' | 'indigo';
}) {
  const colors = {
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    indigo:  'bg-indigo-50 text-indigo-600',
  };
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
            {icon}
          </div>
          {trend === 'up' ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-xs font-medium text-slate-400">{trendValue}</p>
      </CardBody>
    </Card>
  );
}
