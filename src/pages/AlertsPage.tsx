import { useState } from 'react';
import { Bell, AlertTriangle, CheckCircle2, Info, Filter } from 'lucide-react';
import { useDeviceData } from '@/hooks/useDeviceData';
import { Card, CardHeader, CardBody, Badge, Button, Spinner, EmptyState } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { api } from '@/services/api';
import { useDevice } from '@/context/DeviceContext';
import { timeAgo, formatDateTime } from '@/lib/utils';
import type { Alert } from '@/types';

export default function AlertsPage() {
  const { alerts, loading, refresh } = useDeviceData();
  const { activeDevice } = useDevice();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const filtered = alerts.filter((a) => {
    if (filter === 'active') return !a.resolved;
    if (filter === 'resolved') return a.resolved;
    return true;
  });

  const handleResolve = async (alert: Alert) => {
    await api.resolveAlert(alert.id);
    refresh();
  };

  const severityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="h-5 w-5 text-red-600" />;
    if (severity === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    if (severity === 'info') return <Info className="h-5 w-5 text-blue-600" />;
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  };

  const severityBg = (severity: string) => {
    if (severity === 'critical') return 'bg-red-50 border-red-100';
    if (severity === 'warning') return 'bg-amber-50 border-amber-100';
    return 'bg-blue-50 border-blue-100';
  };

  const counts = {
    critical: alerts.filter((a) => a.severity === 'critical' && !a.resolved).length,
    warning: alerts.filter((a) => a.severity === 'warning' && !a.resolved).length,
    info: alerts.filter((a) => a.severity === 'info' && !a.resolved).length,
  };

  return (
    <>
      <PageHeader title="Alert Center" subtitle="Monitor and manage all system alerts" />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{counts.critical}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">Critical Alerts</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{counts.warning}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">Warnings</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Info className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{counts.info}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">Info Alerts</p>
          </CardBody>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {(['active', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <Card>
        <CardHeader title={`${filter === 'active' ? 'Active' : filter === 'resolved' ? 'Resolved' : 'All'} Alerts`} icon={<Bell className="h-5 w-5" />} />
        <CardBody className="space-y-3">
          {filtered.length === 0 && (
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12" />}
              title={filter === 'active' ? 'No active alerts' : 'No alerts found'}
              message={filter === 'active' ? 'All systems are operating normally.' : undefined}
            />
          )}
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 ${alert.resolved ? 'bg-slate-50 border-slate-100 opacity-60' : severityBg(alert.severity)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{severityIcon(alert.severity)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                      <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}>
                        {alert.severity}
                      </Badge>
                      {alert.resolved && <Badge variant="success">Resolved</Badge>}
                    </div>
                    {alert.message && <p className="mt-1 text-sm text-slate-600">{alert.message}</p>}
                    {alert.action && !alert.resolved && (
                      <p className="mt-1 text-xs text-blue-600">Recommended: {alert.action}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(alert.created_at)} · {timeAgo(alert.created_at)}</p>
                  </div>
                </div>
                {!alert.resolved && (
                  <Button variant="secondary" size="sm" onClick={() => handleResolve(alert)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
