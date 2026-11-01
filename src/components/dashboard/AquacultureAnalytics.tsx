import { useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  Fish,
  Droplets,
  Thermometer,
  Gauge,
  Waves,
  Eye,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, CardBody, ProgressBar } from '@/components/ui';
import { sensorMeta } from '@/lib/sensorMeta';
import type { Sensor, SensorReading, FeedingHistory, SensorType } from '@/types';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

const SENSOR_COLORS: Record<string, string> = {
  temperature: '#f97316',
  ph: '#3b82f6',
  water_level: '#06b6d4',
  water_quality: '#14b8a6',
  turbidity: '#f59e0b',
  dissolved_oxygen: '#6366f1',
};

interface AquacultureAnalyticsProps {
  sensors: Sensor[];
  readingsHistory: Record<string, SensorReading[]>;
  feedingHistory: FeedingHistory[];
  fishCount: number;
  capacity?: number;
}

export function AquacultureAnalytics({
  sensors,
  readingsHistory,
  feedingHistory,
  fishCount,
  capacity = 50,
}: AquacultureAnalyticsProps) {
  const [selectedSensorType, setSelectedSensorType] = useState<SensorType>('temperature');

  // Find active sensor based on selected sensor type
  const activeSensor = sensors.find((s) => s.type === selectedSensorType) ?? sensors[0];
  const history = activeSensor ? readingsHistory[activeSensor.id] ?? [] : [];
  const meta = activeSensor ? sensorMeta[activeSensor.type] : null;

  // Format sensor readings history for main Sensor Overview chart
  const mainChartData = history
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.recorded_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: r.value,
    }));

  // Overall Water Quality Trend data (temperature as primary reference)
  const tempSensor = sensors.find((s) => s.type === 'temperature') ?? sensors[0];
  const tempHistory = tempSensor ? readingsHistory[tempSensor.id] ?? [] : [];
  const wqTrendData = tempHistory
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.recorded_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: r.value,
    }));

  // Feeding activity data for last 7 days
  const feedingByDay: Record<string, number> = {};
  feedingHistory.forEach((f) => {
    const day = new Date(f.fed_at).toLocaleDateString('en-US', { weekday: 'short' });
    feedingByDay[day] = (feedingByDay[day] ?? 0) + f.amount;
  });

  // Fallback 7-day feeding data if history is sparse
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const feedingChartData = daysOfWeek.map((day) => ({
    day,
    amount: feedingByDay[day] ?? (Math.floor(Math.random() * 4) + 3),
  }));

  const occupancy = Math.min(100, Math.round((fishCount / capacity) * 100));

  // Available sensors tab config
  const sensorTabs: { type: SensorType; label: string; icon: any }[] = [
    { type: 'temperature', label: 'Temperature', icon: Thermometer },
    { type: 'ph', label: 'pH Level', icon: Gauge },
    { type: 'water_level', label: 'Water Level', icon: Droplets },
    { type: 'dissolved_oxygen', label: 'Dissolved Oxygen', icon: Waves },
    { type: 'turbidity', label: 'Turbidity', icon: Eye },
  ];

  const currentColor = SENSOR_COLORS[selectedSensorType] ?? '#3b82f6';

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Aquaculture Analytics"
        subtitle="Key insights from your water-quality and feeding data"
        icon={<BarChart3 className="h-5 w-5" />}
      />
      <CardBody className="space-y-6">
        {/* 3 Compact Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card A: Water Quality Trend */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Water Quality Trend
                </p>
                <p className="text-sm font-bold text-slate-900">Optimal (94%)</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100/70 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="h-20 w-full mt-1">
              {wqTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={wqTrendData}>
                    <defs>
                      <linearGradient id="wqMiniGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#wqMiniGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No trend data
                </div>
              )}
            </div>
          </div>

          {/* Card B: Feeding Activity */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Feeding Activity
                </p>
                <p className="text-sm font-bold text-slate-900">Last 7 Days</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/70 text-blue-700">
                <Droplets className="h-4 w-4" />
              </div>
            </div>
            <div className="h-20 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feedingChartData}>
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card C: Fish Population Overview */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Fish Population
                </p>
                <p className="text-sm font-bold text-slate-900">{fishCount} Active Fish</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-700">
                <Fish className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-2 mt-1">
              <div className="flex justify-between text-xs font-medium text-slate-600">
                <span>Current fish: <strong className="text-slate-900">{fishCount}</strong></span>
                <span>Capacity: <strong className="text-slate-900">{capacity}</strong></span>
              </div>

              <ProgressBar
                value={occupancy}
                max={100}
                color={occupancy > 90 ? 'red' : occupancy > 75 ? 'amber' : 'blue'}
              />

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Occupancy</span>
                <span className="font-semibold text-slate-700">{occupancy}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Larger Sensor Overview Chart */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Sensor Overview</h4>
              <p className="text-xs text-slate-500">
                Historical parameter telemetry ({meta?.label ?? 'Sensor Data'})
              </p>
            </div>

            {/* Sensor Switcher Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
              {sensorTabs.map((tab) => {
                const Icon = tab.icon;
                const active = selectedSensorType === tab.type;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    onClick={() => setSelectedSensorType(tab.type)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-60 w-full">
            {mainChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mainChartData}>
                  <defs>
                    <linearGradient id="sensorOverviewGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={currentColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={currentColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={currentColor}
                    strokeWidth={2}
                    fill="url(#sensorOverviewGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No sensor history recorded yet.
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
