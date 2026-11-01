import { Card, CardBody, Badge, StatusDot } from '@/components/ui';
import { Activity, Clock } from 'lucide-react';
import { useMqtt } from '@/context/MqttContext';
import type { SystemStatusItem } from '@/types';

interface SystemStatusCardProps {
  statuses?: SystemStatusItem[];
  lastUpdateText?: string;
  isAllHealthy?: boolean;
}

/**
 * Renders a live system-status card that reflects the real MQTT connection
 * state from Mosquitto.  The ESP32 / Sensors rows derive their status from
 * the single MQTT connection status; Local Server and Database remain static
 * since they are always running when the UI loads.
 */
export function SystemStatusCard({
  statuses,
  lastUpdateText,
  isAllHealthy,
}: SystemStatusCardProps) {
  const { mqttStatus, liveSensorData } = useMqtt();

  // Derive live status rows from MQTT connection state
  const mqttConnected = mqttStatus === 'connected';
  const mqttReconnecting = mqttStatus === 'reconnecting' || mqttStatus === 'connecting';

  const esp32Status = mqttConnected
    ? 'online'
    : mqttReconnecting
    ? 'warning'
    : 'offline';
  const esp32Text = mqttConnected
    ? 'Online'
    : mqttReconnecting
    ? 'Reconnecting…'
    : 'Offline';

  const liveStatuses: SystemStatusItem[] = statuses ?? [
    { label: 'ESP32 Controller', status: esp32Status, statusText: esp32Text },
    { label: 'MQTT Broker', status: mqttConnected ? 'connected' : mqttReconnecting ? 'warning' : 'offline', statusText: mqttConnected ? 'Connected' : mqttReconnecting ? 'Reconnecting…' : 'Offline' },
    { label: 'Local Server', status: 'running', statusText: 'Running' },
    { label: 'Database', status: 'connected', statusText: 'Connected' },
  ];

  const allHealthy =
    isAllHealthy !== undefined
      ? isAllHealthy
      : liveStatuses.every((s) =>
          ['online', 'connected', 'running'].includes(s.status)
        );

  const lastUpdate =
    lastUpdateText ??
    (mqttConnected && liveSensorData
      ? `Last MQTT update: just now`
      : mqttConnected
      ? 'MQTT connected — awaiting data'
      : mqttReconnecting
      ? `MQTT: ${mqttStatus}…`
      : 'MQTT broker unreachable');

  return (
    <Card className="h-[244px] overflow-hidden flex flex-col justify-between">
      <CardBody className="flex flex-col justify-between h-full">
        <div>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">System Status</p>
                <p className="text-xs text-slate-500">Device &amp; connection health</p>
              </div>
            </div>
            <Badge variant={allHealthy ? 'success' : 'warning'}>
              <StatusDot status={allHealthy ? 'online' : 'warning'} />
              {allHealthy ? 'Healthy' : 'Attention'}
            </Badge>
          </div>

          {/* Status List */}
          <div className="mt-4 space-y-2.5">
            {liveStatuses.map((item) => {
              const isHealthy = ['online', 'connected', 'running'].includes(item.status);
              return (
                <div key={item.label} className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isHealthy
                          ? 'bg-emerald-500'
                          : item.status === 'warning'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-red-400'
                      }`}
                    />
                    <span
                      className={
                        isHealthy
                          ? 'text-emerald-700 font-medium'
                          : item.status === 'warning'
                          ? 'text-amber-600 font-medium'
                          : 'text-red-600 font-medium'
                      }
                    >
                      {item.statusText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-slate-100 pt-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{lastUpdate}</span>
          </div>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
              mqttConnected
                ? 'text-emerald-600 bg-emerald-50'
                : mqttReconnecting
                ? 'text-amber-600 bg-amber-50'
                : 'text-slate-400 bg-slate-100'
            }`}
          >
            ESP32-AN1
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
