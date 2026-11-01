export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  device_id: string;
  name: string;
  status: string;
  firmware_version: string;
  installed_at: string;
  last_data_at: string | null;
  wifi_signal: number;
  uptime_seconds: number;
  created_at: string;
}

export interface Sensor {
  id: string;
  device_id: string;
  type: string;
  name: string;
  unit: string;
  min_range: number | null;
  max_range: number | null;
  status: string;
  created_at: string;
}

export interface SensorReading {
  id: string;
  device_id: string;
  sensor_id: string;
  value: number;
  status: string;
  recorded_at: string;
}

export interface FeedingSchedule {
  id: string;
  device_id: string;
  feed_time: string;
  amount: number;
  enabled: boolean;
  frequency?: 'once' | 'daily' | 'custom';
  custom_days?: number[];
  created_at: string;
}

export interface FeedingHistory {
  id: string;
  device_id: string;
  amount: number;
  trigger_type: string;
  fed_at: string;
}

export interface Alert {
  id: string;
  device_id: string;
  severity: string;
  source: string;
  title: string;
  message: string | null;
  action: string | null;
  resolved: boolean;
  created_at: string;
}

export interface AiPrediction {
  id: string;
  device_id: string;
  model_type: string;
  health_score: number | null;
  predicted_value: number | null;
  predicted_for: string | null;
  factors: Record<string, number> | null;
  created_at: string;
}

export interface Anomaly {
  id: string;
  device_id: string;
  source: string;
  sensor_type: string | null;
  description: string;
  severity: string;
  detected_at: string;
}

export interface Recommendation {
  id: string;
  device_id: string;
  level: string;
  message: string;
  created_at: string;
}

export interface Camera {
  id: string;
  device_id: string;
  camera_id: string;
  stream_url: string | null;
  status: string;
  last_connected_at: string | null;
  recording_enabled: boolean;
  created_at: string;
}

export interface CameraSnapshot {
  id: string;
  device_id: string;
  camera_id: string;
  image_url: string | null;
  notes: string | null;
  captured_at: string;
}

export interface CameraAnalysis {
  id: string;
  device_id: string;
  fish_activity: string;
  feeding_activity: string;
  fish_movement: string;
  tank_visibility: string;
  dead_fish_detected: boolean;
  summary: string | null;
  analyzed_at: string;
}

export type SensorType =
  | 'temperature'
  | 'ph'
  | 'water_level'
  | 'water_quality'
  | 'turbidity'
  | 'dissolved_oxygen';

export interface SystemStatusItem {
  label: string;
  status: 'online' | 'connected' | 'running' | 'offline' | 'error' | 'warning';
  statusText: string;
}

export interface FishPopulationData {
  deviceId: string;
  count: number;
  capacity: number;
  lastUpdated?: string;
}

