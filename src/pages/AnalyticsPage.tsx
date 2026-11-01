import { useState } from 'react';
import { BarChart3, TrendingUp, Activity, Download, FlaskConical } from 'lucide-react';
import { useDeviceData } from '@/hooks/useDeviceData';
import { useAuth } from '@/context/AuthContext';
import { useDevice } from '@/context/DeviceContext';
import { useMqtt } from '@/context/MqttContext';
import { Card, CardHeader, CardBody, Spinner, EmptyState, Button } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { sensorMeta } from '@/lib/sensorMeta';
import { generatePdfReport } from '@/lib/pdfGenerator';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const COLORS: Record<string, string> = {
  temperature: '#f97316',
  ph: '#3b82f6',
  water_level: '#06b6d4',
  water_quality: '#14b8a6',
  turbidity: '#f59e0b',
  dissolved_oxygen: '#6366f1',
};

export default function AnalyticsPage() {
  const { sensors, latestReadings, readingsHistory, feedingHistory, alerts, predictions, recommendations, loading } = useDeviceData();
  const { user } = useAuth();
  const { activeDevice } = useDevice();
  const { isUsingMockData } = useMqtt();
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);

  const handleExport = () => {
    generatePdfReport({
      reportTitle: 'Aquaculture Telemetry & Analytics Report',
      user: user ? { full_name: user.name || user.email } : null,
      activeDevice,
      sensors,
      latestReadings,
      alerts,
      feedingHistory,
      predictions,
      recommendations,
    });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (sensors.length === 0) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Historical trends and data visualization" />
        <Card>
          <EmptyState icon={<BarChart3 className="h-12 w-12" />} title="No data available" />
        </Card>
      </>
    );
  }

  const activeSensorId = selectedSensor ?? sensors[0]?.id;
  const activeSensor = sensors.find((s) => s.id === activeSensorId);
  const history = activeSensor ? readingsHistory[activeSensor.id] ?? [] : [];
  const meta = activeSensor ? sensorMeta[activeSensor.type] : null;

  const chartData = history
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: r.value,
    }));

  // Feeding history chart (last 7 days grouped)
  const feedingByDay: Record<string, number> = {};
  feedingHistory.forEach((f) => {
    const day = new Date(f.fed_at).toLocaleDateString('en-US', { weekday: 'short' });
    feedingByDay[day] = (feedingByDay[day] ?? 0) + f.amount;
  });
  const feedingChartData = Object.entries(feedingByDay)
    .reverse()
    .map(([day, amount]) => ({ day, amount }));

  // Multi-sensor comparison data (last 20 readings aligned by index)
  const maxLen = Math.max(...sensors.map((s) => (readingsHistory[s.id] ?? []).length), 0);
  const comparisonData: Record<string, number | string>[] = [];
  for (let i = 0; i < Math.min(maxLen, 50); i++) {
    const point: Record<string, number | string> = { time: `${i}` };
    sensors.forEach((s) => {
      const hist = readingsHistory[s.id] ?? [];
      const idx = hist.length - 1 - i;
      if (idx >= 0) point[s.type] = hist[idx].value;
    });
    comparisonData.push(point);
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Historical trends and data visualization"
        action={
          <div className="flex items-center gap-3">
            {isUsingMockData && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <FlaskConical className="h-3.5 w-3.5" /> Demo Data
              </span>
            )}
            <Button variant="secondary" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        }
      />

      {/* Sensor selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {sensors.map((s) => {
          const m = sensorMeta[s.type];
          if (!m) return null;
          const Icon = m.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedSensor(s.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                activeSensorId === s.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {m.shortLabel}
            </button>
          );
        })}
      </div>

      {/* Main chart */}
      <Card className="mb-6">
        <CardHeader
          title={meta?.label ?? 'Sensor Data'}
          subtitle="Last 8 hours of readings"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sensorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta ? COLORS[activeSensor?.type ?? ''] ?? '#3b82f6' : '#3b82f6'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={meta ? COLORS[activeSensor?.type ?? ''] ?? '#3b82f6' : '#3b82f6'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={meta ? COLORS[activeSensor?.type ?? ''] ?? '#3b82f6' : '#3b82f6'}
                strokeWidth={2}
                fill="url(#sensorGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Multi-sensor comparison */}
        <Card>
          <CardHeader title="Multi-Sensor Comparison" subtitle="All sensors over time" icon={<Activity className="h-5 w-5" />} />
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {sensors.map((s) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.type}
                    stroke={COLORS[s.type] ?? '#3b82f6'}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Feeding chart */}
        <Card>
          <CardHeader title="Feeding Summary" subtitle="Daily feed totals (last 7 days)" icon={<BarChart3 className="h-5 w-5" />} />
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={feedingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
