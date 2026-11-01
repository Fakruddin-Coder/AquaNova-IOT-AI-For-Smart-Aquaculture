import { Brain, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Activity, Fish, Eye, Zap, FlaskConical } from 'lucide-react';
import { useAiData } from '@/hooks/useAiData';
import { useMqtt } from '@/context/MqttContext';
import { Card, CardHeader, CardBody, Badge, ProgressBar, Spinner, EmptyState } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { timeAgo } from '@/lib/utils';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

export default function AiPage() {
  const { activeSensorData, isUsingMockData } = useMqtt();
  const { predictions, anomalies, recommendations, cameraAnalysis, loading, error } = useAiData(activeSensorData);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && predictions.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-slate-600">{error}</p>
      </div>
    );
  }

  const healthPred = predictions.find((p) => p.model_type === 'health_score');
  const tempPred = predictions.find((p) => p.model_type === 'temperature_forecast');
  const healthScore = healthPred?.health_score ?? 0;
  const factors = healthPred?.factors ?? {};

  const radarData = Object.entries(factors).map(([key, val]) => ({
    factor: key.charAt(0).toUpperCase() + key.slice(1),
    value: Math.round((val as number) * 100),
  }));

  const latestCamAnalysis = cameraAnalysis[0];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <PageHeader title="AI Intelligence" subtitle="Machine learning predictions and computer vision insights" />
        {isUsingMockData && (
          <Badge variant="warning" className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Demo Data
          </Badge>
        )}
      </div>

      {/* AI Health Score + Radar */}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="AI Health Score" subtitle="Composite ML prediction" icon={<Sparkles className="h-5 w-5" />} />
          <CardBody>
            <div className="flex flex-col items-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <svg className="h-36 w-36 -rotate-90">
                  <circle cx="72" cy="72" r="64" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(healthScore / 100) * 402.12} 402.12`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-4xl font-bold text-slate-900">{healthScore}</p>
                  <p className="text-xs text-slate-500">out of 100</p>
                </div>
              </div>
              <Badge variant={healthScore >= 80 ? 'success' : 'warning'} className="mt-4">
                {healthScore >= 80 ? 'Healthy System' : 'Needs Attention'}
              </Badge>
              {healthPred && (
                <p className="mt-2 text-xs text-slate-400">Updated {timeAgo(healthPred.created_at)}</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Factor Analysis" subtitle="Contributing factors to health score" icon={<Activity className="h-5 w-5" />} />
          <CardBody>
            {radarData.length > 0 ? (
              <div className="grid items-center sm:grid-cols-2">
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {radarData.map((d) => (
                    <div key={d.factor}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{d.factor}</span>
                        <span className="text-sm font-bold text-slate-900">{d.value}%</span>
                      </div>
                      <ProgressBar value={d.value} color={d.value >= 80 ? 'emerald' : d.value >= 60 ? 'amber' : 'red'} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={<Activity className="h-8 w-8" />} title="No factor data available" />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Predictions */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Predictions" subtitle="ML model forecasts" icon={<TrendingUp className="h-5 w-5" />} />
          <CardBody className="space-y-3">
            {tempPred && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Temperature Forecast</p>
                    <p className="text-xs text-slate-500">Predicted in 6 hours</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{tempPred.predicted_value?.toFixed(1)}°C</p>
                </div>
                {tempPred.factors && (
                  <p className="mt-2 text-xs text-slate-500">
                    Confidence: {Math.round((tempPred.factors.confidence as number) * 100)}% · Trend: {((tempPred.factors.trend as number) > 0 ? '+' : '')}{(tempPred.factors.trend as number).toFixed(2)}°C/hr
                  </p>
                )}
              </div>
            )}
            {predictions.filter((p) => p.model_type !== 'health_score' && p.model_type !== 'temperature_forecast').map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-medium text-slate-900">{p.model_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                <p className="text-xs text-slate-500">{timeAgo(p.created_at)}</p>
              </div>
            ))}
            {predictions.length === 0 && (
              <EmptyState icon={<Brain className="h-8 w-8" />} title="No predictions yet" />
            )}
          </CardBody>
        </Card>

        {/* Anomalies */}
        <Card>
          <CardHeader title="Anomaly Detection" subtitle="Detected by AI" icon={<AlertTriangle className="h-5 w-5" />} />
          <CardBody className="space-y-3">
            {anomalies.length === 0 && (
              <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="No anomalies detected" message="All systems normal." />
            )}
            {anomalies.map((a) => (
              <div key={a.id} className={`rounded-xl p-4 ${a.severity === 'critical' ? 'border border-red-100 bg-red-50' : 'border border-amber-100 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 shrink-0 ${a.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{a.source === 'sensor' ? 'Sensor Anomaly' : 'Camera Anomaly'}</p>
                      <Badge variant={a.severity === 'critical' ? 'danger' : 'warning'}>{a.severity}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{a.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(a.detected_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Camera AI Analysis */}
      {latestCamAnalysis && (
        <Card className="mb-6">
          <CardHeader title="Computer Vision Analysis" subtitle="AI camera analysis results" icon={<Eye className="h-5 w-5" />} />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AnalysisTile label="Fish Activity" value={latestCamAnalysis.fish_activity} icon={<Fish className="h-5 w-5" />} />
              <AnalysisTile label="Feeding Activity" value={latestCamAnalysis.feeding_activity} icon={<Zap className="h-5 w-5" />} />
              <AnalysisTile label="Fish Movement" value={latestCamAnalysis.fish_movement} icon={<Activity className="h-5 w-5" />} />
              <AnalysisTile label="Tank Visibility" value={latestCamAnalysis.tank_visibility} icon={<Eye className="h-5 w-5" />} />
            </div>
            {latestCamAnalysis.summary && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-600">{latestCamAnalysis.summary}</p>
              </div>
            )}
            {latestCamAnalysis.dead_fish_detected && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                Dead fish detected — please inspect the tank immediately.
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader title="Smart Recommendations" subtitle="AI-generated insights" icon={<Brain className="h-5 w-5" />} />
        <CardBody className="space-y-3">
          {recommendations.length === 0 && (
            <EmptyState icon={<Brain className="h-8 w-8" />} title="No recommendations yet" />
          )}
          {recommendations.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl p-4 ${
                r.level === 'healthy' ? 'border border-emerald-100 bg-emerald-50' : 'border border-amber-100 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {r.level === 'healthy' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{r.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{timeAgo(r.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}

function AnalysisTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const isGood = value === 'normal' || value === 'good' || value === 'detected';
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
        {icon}
      </div>
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold capitalize ${isGood ? 'text-emerald-700' : 'text-amber-700'}`}>
        {value.replace(/_/g, ' ')}
      </p>
    </div>
  );
}
