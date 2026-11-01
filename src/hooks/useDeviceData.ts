/**
 * useDeviceData — Data loader for alerts, feeding, AI, camera, and historical telemetry.
 *
 * For Dashboard sensor cards:
 *   DashboardPage reads live sensor values directly from useMqtt().liveSensorData
 *   without any REST fallback or averaging.
 *
 * For AnalyticsPage, AssistantPage, and ReportsPage:
 *   This hook provides sensors metadata, latestReadings (merged with live MQTT data),
 *   and readingsHistory from REST.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useMqtt } from '@/context/MqttContext';
import { api } from '@/services/api';
import { useDevice } from '@/context/DeviceContext';
import { useAiData } from '@/hooks/useAiData';
import { getSensorStatus, sensorMeta } from '@/lib/sensorMeta';
import type {
  Sensor,
  SensorReading,
  Alert,
  FeedingSchedule,
  FeedingHistory,
  AiPrediction,
  Anomaly,
  Recommendation,
  Camera,
  CameraAnalysis,
} from '@/types';

export function useDeviceData() {
  const { activeDevice } = useDevice();
  const deviceId = activeDevice?.device_id || activeDevice?.id || null;
  const { activeSensorData, isUsingMockData } = useMqtt();
  const liveAi = useAiData(activeSensorData);

  const [sensors,          setSensors]          = useState<Sensor[]>([]);
  const [rawLatest,        setRawLatest]        = useState<Record<string, SensorReading | null>>({});
  const [readingsHistory,  setReadingsHistory]  = useState<Record<string, SensorReading[]>>({});
  const [alerts,           setAlerts]           = useState<Alert[]>([]);
  const [feedingSchedules, setFeedingSchedules] = useState<FeedingSchedule[]>([]);
  const [feedingHistory,   setFeedingHistory]   = useState<FeedingHistory[]>([]);
  const [predictions,      setPredictions]      = useState<AiPrediction[]>([]);
  const [anomalies,        setAnomalies]        = useState<Anomaly[]>([]);
  const [recommendations,  setRecommendations]  = useState<Recommendation[]>([]);
  const [cameras,          setCameras]          = useState<Camera[]>([]);
  const [cameraAnalysis,   setCameraAnalysis]   = useState<CameraAnalysis[]>([]);
  const [loading,          setLoading]          = useState(true);

  const load = useCallback(async () => {
    if (!deviceId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const defaultSensors: Sensor[] = [
      { id: 'temp-1', device_id: deviceId, type: 'temperature', name: 'Water Temperature', unit: '°C', min_range: 22, max_range: 30, status: 'normal', created_at: new Date().toISOString() },
      { id: 'ph-1', device_id: deviceId, type: 'ph', name: 'pH Sensor', unit: 'pH', min_range: 6.5, max_range: 8.5, status: 'normal', created_at: new Date().toISOString() },
      { id: 'wl-1', device_id: deviceId, type: 'water_level', name: 'Water Level', unit: '%', min_range: 50, max_range: 100, status: 'normal', created_at: new Date().toISOString() },
      { id: 'do-1', device_id: deviceId, type: 'dissolved_oxygen', name: 'Dissolved Oxygen', unit: 'mg/L', min_range: 5, max_range: 10, status: 'normal', created_at: new Date().toISOString() },
      { id: 'turb-1', device_id: deviceId, type: 'turbidity', name: 'Turbidity', unit: 'NTU', min_range: 0, max_range: 10, status: 'normal', created_at: new Date().toISOString() },
    ];
    setSensors(defaultSensors);

    const dash = await api.getDashboard(deviceId);

    if (dash) {
      // ── Latest readings baseline ─────────────────────────────────────────────
      const latest: Record<string, SensorReading | null> = {
        'temp-1': { id: 'sr-temp', device_id: deviceId, sensor_id: 'temp-1', value: dash.latestReadings?.temperature ?? 26.5, status: 'normal', recorded_at: dash.latestReadings?.timestamp || new Date().toISOString() },
        'ph-1': { id: 'sr-ph', device_id: deviceId, sensor_id: 'ph-1', value: dash.latestReadings?.ph ?? 7.2, status: 'normal', recorded_at: dash.latestReadings?.timestamp || new Date().toISOString() },
        'wl-1': { id: 'sr-wl', device_id: deviceId, sensor_id: 'wl-1', value: dash.latestReadings?.waterLevel ?? 85, status: 'normal', recorded_at: dash.latestReadings?.timestamp || new Date().toISOString() },
        'do-1': { id: 'sr-do', device_id: deviceId, sensor_id: 'do-1', value: dash.latestReadings?.otherSensorValues?.dissolvedOxygen ?? 6.8, status: 'normal', recorded_at: dash.latestReadings?.timestamp || new Date().toISOString() },
        'turb-1': { id: 'sr-turb', device_id: deviceId, sensor_id: 'turb-1', value: dash.latestReadings?.otherSensorValues?.turbidity ?? 3.2, status: 'normal', recorded_at: dash.latestReadings?.timestamp || new Date().toISOString() },
      };
      setRawLatest(latest);

      // ── Readings history for charts ──────────────────────────────────────────
      const historyList: any[] = dash.recentHistory || [];
      const historyMap: Record<string, SensorReading[]> = {
        'temp-1': historyList.map((h, idx) => ({ id: `th-${idx}`, device_id: deviceId, sensor_id: 'temp-1', value: h.temperature ?? 26.5, status: 'normal', recorded_at: h.timestamp || h.createdAt || new Date().toISOString() })),
        'ph-1': historyList.map((h, idx) => ({ id: `phh-${idx}`, device_id: deviceId, sensor_id: 'ph-1', value: h.ph ?? 7.2, status: 'normal', recorded_at: h.timestamp || h.createdAt || new Date().toISOString() })),
        'wl-1': historyList.map((h, idx) => ({ id: `wlh-${idx}`, device_id: deviceId, sensor_id: 'wl-1', value: h.waterLevel ?? 85, status: 'normal', recorded_at: h.timestamp || h.createdAt || new Date().toISOString() })),
        'do-1': historyList.map((h, idx) => ({ id: `doh-${idx}`, device_id: deviceId, sensor_id: 'do-1', value: h.otherSensorValues?.dissolvedOxygen ?? 6.8, status: 'normal', recorded_at: h.timestamp || h.createdAt || new Date().toISOString() })),
        'turb-1': historyList.map((h, idx) => ({ id: `turbh-${idx}`, device_id: deviceId, sensor_id: 'turb-1', value: h.otherSensorValues?.turbidity ?? 3.2, status: 'normal', recorded_at: h.timestamp || h.createdAt || new Date().toISOString() })),
      };
      setReadingsHistory(historyMap);

      // ── Alerts ──────────────────────────────────────────────────────────────
      setAlerts(
        (dash.recentAlerts || []).map((a: any) => ({
          id:         a._id || a.id,
          device_id:  deviceId,
          severity:   a.severity  || 'warning',
          source:     'Sensor Node',
          title:      a.type      || 'System Alert',
          message:    a.message,
          action:     a.resolved  ? 'Resolved' : 'Review Parameter',
          resolved:   !!a.resolved,
          created_at: a.timestamp || a.createdAt || new Date().toISOString(),
        }))
      );

      // ── Feeding ──────────────────────────────────────────────────────────────
      try {
        const feedingRes = await api.getFeeding(deviceId);
        if (feedingRes && (Array.isArray(feedingRes.schedules) || Array.isArray(feedingRes.history))) {
          const rawS = Array.isArray(feedingRes.schedules) ? feedingRes.schedules : [];
          setFeedingSchedules(
            rawS
              .filter((s: any) => (s.status === 'scheduled' || !s.status) && s.triggerType !== 'manual')
              .map((s: any) => ({
                id:          s._id || s.id,
                device_id:   deviceId,
                feed_time:   s.scheduledTime || s.feed_time || '12:00',
                amount:      s.feedAmount    || s.amount    || 5,
                enabled:     s.enabled !== false,
                frequency:   s.frequency || 'daily',
                custom_days: Array.isArray(s.customDays) ? s.customDays : Array.isArray(s.custom_days) ? s.custom_days : [],
                created_at:  s.createdAt || new Date().toISOString(),
              }))
          );

          const rawH = Array.isArray(feedingRes.history) ? feedingRes.history : [];
          setFeedingHistory(
            rawH.map((s: any) => ({
              id:           s._id || s.id,
              device_id:    deviceId,
              amount:       s.feedAmount || s.amount || 5,
              trigger_type: s.triggerType || 'manual',
              fed_at:       s.updatedAt  || s.createdAt || new Date().toISOString(),
            }))
          );
        } else {
          const rawSchedules = dash.feedingStatus?.schedules || [];
          setFeedingSchedules(
            rawSchedules
              .filter((s: any) => (s.status === 'scheduled' || !s.status) && s.triggerType !== 'manual')
              .map((s: any) => ({
                id:          s._id || s.id,
                device_id:   deviceId,
                feed_time:   s.scheduledTime || s.feed_time || '12:00',
                amount:      s.feedAmount    || s.amount    || 5,
                enabled:     s.enabled !== false,
                frequency:   s.frequency || 'daily',
                custom_days: Array.isArray(s.customDays) ? s.customDays : Array.isArray(s.custom_days) ? s.custom_days : [],
                created_at:  s.createdAt || new Date().toISOString(),
              }))
          );
          setFeedingHistory(
            rawSchedules
              .filter((s: any) => s.status === 'completed' || s.triggerType === 'manual')
              .map((s: any) => ({
                id:           s._id || s.id,
                device_id:    deviceId,
                amount:       s.feedAmount || s.amount || 5,
                trigger_type: s.triggerType || 'scheduled',
                fed_at:       s.updatedAt  || s.createdAt || new Date().toISOString(),
              }))
          );
        }
      } catch (e) {
        const rawSchedules = dash.feedingStatus?.schedules || [];
        setFeedingSchedules(
          rawSchedules
            .filter((s: any) => (s.status === 'scheduled' || !s.status) && s.triggerType !== 'manual')
            .map((s: any) => ({
              id:          s._id || s.id,
              device_id:   deviceId,
              feed_time:   s.scheduledTime || s.feed_time || '12:00',
              amount:      s.feedAmount    || s.amount    || 5,
              enabled:     s.enabled !== false,
              frequency:   s.frequency || 'daily',
              custom_days: Array.isArray(s.customDays) ? s.customDays : Array.isArray(s.custom_days) ? s.custom_days : [],
              created_at:  s.createdAt || new Date().toISOString(),
            }))
        );
        setFeedingHistory(
          rawSchedules
            .filter((s: any) => s.status === 'completed' || s.triggerType === 'manual')
            .map((s: any) => ({
              id:           s._id || s.id,
              device_id:    deviceId,
              amount:       s.feedAmount || s.amount || 5,
              trigger_type: s.triggerType || 'scheduled',
              fed_at:       s.updatedAt  || s.createdAt || new Date().toISOString(),
            }))
        );
      }

      // ── AI predictions, anomalies, recommendations ───────────────────────────
      const ai = dash.aiAnalysis || {};

      setPredictions([
        {
          id:              'pred-1',
          device_id:       deviceId,
          model_type:      'Aquaculture Health Predictor',
          health_score:    dash.aiHealthScore ?? 94,
          predicted_value: 26.8,
          predicted_for:   new Date(Date.now() + 86_400_000).toISOString(),
          factors:         { temperature: 0.9, ph: 0.95, waterLevel: 0.88 },
          created_at:      new Date().toISOString(),
        },
      ]);

      setAnomalies(
        (ai.anomalies || []).map((a: any, i: number) => ({
          id:          `anom-${i}`,
          device_id:   deviceId,
          source:      a.source      || 'AI Engine',
          sensor_type: 'ph',
          description: a.description || 'Minor parameter drift',
          severity:    a.severity    || 'low',
          detected_at: a.detected_at || new Date().toISOString(),
        }))
      );

      setRecommendations(
        (ai.recommendations || []).map((r: any, i: number) => ({
          id:         `rec-${i}`,
          device_id:  deviceId,
          level:      r.level   || 'info',
          message:    r.message || 'Optimal conditions maintained',
          created_at: new Date().toISOString(),
        }))
      );

      // ── Camera (independent of MQTT) ─────────────────────────────────────────
      setCameras([
        {
          id:                 'cam-1',
          device_id:          deviceId,
          camera_id:          'CAM-01',
          stream_url:         null,
          status:             'online',
          last_connected_at:  new Date().toISOString(),
          recording_enabled:  true,
          created_at:         new Date().toISOString(),
        },
      ]);

      setCameraAnalysis([
        {
          id:                  'cam-ana-1',
          device_id:           deviceId,
          fish_activity:       'Active',
          feeding_activity:    'Normal',
          fish_movement:       'Lively swimming patterns',
          tank_visibility:     'Clear (98%)',
          dead_fish_detected:  false,
          summary:             'Aquatic fauna behaving normally with healthy appetite response.',
          analyzed_at:         new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
  }, [deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep analytics/report history moving while the backend has no persisted
  // telemetry yet. Each valid MQTT packet (or the stable demo packet) becomes
  // one chart point; duplicate renders do not create duplicate points.
  useEffect(() => {
    if (!deviceId || !activeSensorData) return;
    const recordedAt = new Date().toISOString();
    const fields: Record<string, number> = {
      'temp-1': activeSensorData.temperature,
      'ph-1': activeSensorData.ph,
      'wl-1': activeSensorData.waterLevel,
      'do-1': activeSensorData.dissolvedOxygen,
      'turb-1': activeSensorData.turbidity,
    };
    setReadingsHistory((previous) => {
      const next = { ...previous };
      Object.entries(fields).forEach(([sensorId, value]) => {
        if (!Number.isFinite(value)) return;
        const history = next[sensorId] ?? [];
        const newest = history[0];
        if (newest && newest.value === value && Date.now() - new Date(newest.recorded_at).getTime() < 1500) return;
        next[sensorId] = [
          {
            id: `active-${sensorId}-${recordedAt}`,
            device_id: deviceId,
            sensor_id: sensorId,
            value,
            status: getSensorStatus(value, sensorId === 'temp-1' ? 'temperature' : sensorId === 'wl-1' ? 'water_level' : sensorId === 'do-1' ? 'dissolved_oxygen' : sensorId === 'turb-1' ? 'turbidity' : 'ph'),
            recorded_at: recordedAt,
          },
          ...history,
        ].slice(0, 50);
      });
      return next;
    });
  }, [deviceId, activeSensorData]);

  // Merge MQTT live readings for assistant and reports if available
  const latestReadings = useMemo(() => {
    if (!activeSensorData) return rawLatest;

    const now = new Date().toISOString();
    const overlay: Record<string, SensorReading | null> = { ...rawLatest };

    const sensorTypeById: Record<string, string> = {
      'temp-1': 'temperature',
      'ph-1': 'ph',
      'wl-1': 'water_level',
      'do-1': 'dissolved_oxygen',
      'turb-1': 'turbidity',
    };

    const applyField = (sensorId: string, value: number | undefined) => {
      if (value === undefined || !Number.isFinite(value)) return;
      const existing = overlay[sensorId];
      const sensorType = sensorTypeById[sensorId] || 'temperature';
      overlay[sensorId] = {
        id: existing?.id || `mqtt-${sensorId}`,
        device_id: deviceId || '',
        sensor_id: sensorId,
        value,
        status: getSensorStatus(value, sensorType),
        recorded_at: now,
      };
    };

    applyField('temp-1', activeSensorData.temperature);
    applyField('ph-1', activeSensorData.ph);
    applyField('wl-1', activeSensorData.waterLevel);
    applyField('do-1', activeSensorData.dissolvedOxygen);
    applyField('turb-1', activeSensorData.turbidity);

    return overlay;
  }, [rawLatest, activeSensorData, deviceId]);

  const liveAlerts = useMemo<Alert[]>(() => {
    if (!activeSensorData || !deviceId) return [];

    const values = [
      ['temperature', 'Water Temperature', activeSensorData.temperature],
      ['ph', 'pH Level', activeSensorData.ph],
      ['water_level', 'Water Level', activeSensorData.waterLevel],
      ['dissolved_oxygen', 'Dissolved Oxygen', activeSensorData.dissolvedOxygen],
      ['turbidity', 'Turbidity', activeSensorData.turbidity],
    ] as const;

    return values.flatMap(([type, label, value]) => {
      const status = getSensorStatus(value, type);
      if (status === 'normal') return [];
      const meta = sensorMeta[type];
      return [{
        id: `live-${type}`,
        device_id: deviceId,
        severity: status,
        source: 'Live MQTT sensor',
        title: `${label} ${status === 'critical' ? 'critical' : 'outside optimal range'}`,
        message: `${label} is ${meta.format(value)}. Optimal range: ${meta.optimal[0]}–${meta.optimal[1]} ${meta.unit}.`,
        action: status === 'critical' ? 'Inspect the tank immediately.' : 'Monitor this value and adjust if it persists.',
        resolved: false,
        created_at: new Date().toISOString(),
      }];
    });
  }, [deviceId, activeSensorData]);

  const displayedAlerts = useMemo(() => [...liveAlerts, ...alerts], [liveAlerts, alerts]);

  return {
    sensors,
    latestReadings,
    readingsHistory,
    alerts: displayedAlerts,
    feedingSchedules,
    feedingHistory,
    predictions: liveAi.predictions.length > 0 ? liveAi.predictions : predictions,
    anomalies: liveAi.anomalies.length > 0 ? liveAi.anomalies : anomalies,
    recommendations: liveAi.recommendations.length > 0 ? liveAi.recommendations : recommendations,
    cameras,
    cameraAnalysis,
    loading,
    refresh: load,
  };
}
