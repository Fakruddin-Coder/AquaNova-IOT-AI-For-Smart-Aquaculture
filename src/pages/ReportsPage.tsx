import { FileText, Download, FileBarChart, Calendar, TrendingUp, Droplets, Fish, Brain, FlaskConical } from 'lucide-react';
import { useDeviceData } from '@/hooks/useDeviceData';
import { useAuth } from '@/context/AuthContext';
import { useDevice } from '@/context/DeviceContext';
import { useMqtt } from '@/context/MqttContext';
import { Card, CardHeader, CardBody, Badge, Spinner, EmptyState, Button } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { sensorMeta } from '@/lib/sensorMeta';
import { formatDate, timeAgo } from '@/lib/utils';
import { generatePdfReport } from '@/lib/pdfGenerator';

export default function ReportsPage() {
  const { sensors, latestReadings, alerts, feedingHistory, predictions, anomalies, recommendations, loading } = useDeviceData();
  const { user } = useAuth();
  const { activeDevice } = useDevice();
  const { isUsingMockData } = useMqtt();

  const handleExportPdf = (title?: string) => {
    generatePdfReport({
      reportTitle: title || 'System Health & Aquaculture Report',
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
        <PageHeader title="Reports" subtitle="Generate and export system reports" />
        <Card>
          <EmptyState icon={<FileText className="h-12 w-12" />} title="No data available" />
        </Card>
      </>
    );
  }

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const totalFeed = feedingHistory.reduce((sum, f) => sum + f.amount, 0);
  const autoFeed = feedingHistory.filter((f) => f.trigger_type === 'auto').length;
  const healthScore = predictions.find((p) => p.model_type === 'health_score')?.health_score ?? 0;

  const reportTypes = [
    { icon: TrendingUp, title: 'Water Quality Report', desc: 'Comprehensive sensor data summary with trends and anomalies.', color: 'blue' },
    { icon: Droplets, title: 'Feeding Report', desc: 'Feeding history, amounts, and schedule effectiveness.', color: 'emerald' },
    { icon: Brain, title: 'AI Analysis Report', desc: 'ML predictions, anomaly detection, and recommendations.', color: 'indigo' },
    { icon: Fish, title: 'System Health Report', desc: 'Overall system status, device health, and alert history.', color: 'amber' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Generate and export system reports"
        action={
          <div className="flex items-center gap-3">
            {isUsingMockData && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <FlaskConical className="h-3.5 w-3.5" /> Demo Data
              </span>
            )}
            <Button onClick={() => handleExportPdf('Complete System Summary Report')}>
              <Download className="h-4 w-4" /> Export All
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{sensors.length}</p>
            <p className="text-xs text-slate-500">Active Sensors</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <FileBarChart className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{activeAlerts.length}</p>
            <p className="text-xs text-slate-500">Active Alerts</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Droplets className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{totalFeed}g</p>
            <p className="text-xs text-slate-500">Total Feed Used</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Brain className="h-5 w-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{healthScore}</p>
            <p className="text-xs text-slate-500">AI Health Score</p>
          </CardBody>
        </Card>
      </div>

      {/* Report types */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {reportTypes.map((r) => (
          <Card key={r.title} className="transition-all hover:shadow-md">
            <CardBody>
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[r.color]}`}>
                  <r.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
                  <button
                    onClick={() => handleExportPdf(r.title)}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Sensor readings table */}
      <Card className="mb-6">
        <CardHeader title="Current Sensor Readings" subtitle="Latest values from all sensors" icon={<FileText className="h-5 w-5" />} />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="pb-3 text-left font-medium">Sensor</th>
                <th className="pb-3 text-left font-medium">Type</th>
                <th className="pb-3 text-right font-medium">Value</th>
                <th className="pb-3 text-right font-medium">Status</th>
                <th className="pb-3 text-right font-medium">Last Reading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sensors.map((sensor) => {
                const reading = latestReadings[sensor.id];
                const meta = sensorMeta[sensor.type];
                return (
                  <tr key={sensor.id} className="hover:bg-slate-50">
                    <td className="py-3 text-sm font-medium text-slate-900">{sensor.name}</td>
                    <td className="py-3 text-sm text-slate-600">{meta?.label ?? sensor.type}</td>
                    <td className="py-3 text-right text-sm font-semibold text-slate-900">
                      {reading ? meta?.format(reading.value) : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <Badge variant={reading?.status === 'normal' ? 'success' : 'warning'}>
                        {reading?.status ?? 'offline'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-xs text-slate-400">
                      {reading ? timeAgo(reading.recorded_at) : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* Recent activity log */}
      <Card>
        <CardHeader title="Recent Activity Log" subtitle="Latest system events" icon={<Calendar className="h-5 w-5" />} />
        <CardBody className="space-y-2 max-h-96 overflow-y-auto">
          {[
            ...alerts.slice(0, 5).map((a) => ({ type: 'alert', title: a.title, time: a.created_at, severity: a.severity })),
            ...feedingHistory.slice(0, 5).map((f) => ({ type: 'feeding', title: `${f.amount}g ${f.trigger_type} feeding`, time: f.fed_at, severity: 'info' })),
            ...anomalies.slice(0, 3).map((an) => ({ type: 'anomaly', title: an.description, time: an.detected_at, severity: an.severity })),
          ]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      item.severity === 'critical'
                        ? 'bg-red-50 text-red-600'
                        : item.severity === 'warning'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {item.type === 'alert' ? <FileBarChart className="h-3.5 w-3.5" /> : item.type === 'feeding' ? <Droplets className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
                  </div>
                  <p className="text-sm text-slate-700">{item.title}</p>
                </div>
                <p className="text-xs text-slate-400">{formatDate(item.time)} · {timeAgo(item.time)}</p>
              </div>
            ))}
        </CardBody>
      </Card>
    </>
  );
}
