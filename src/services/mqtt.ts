/**
 * AquaNova — Centralized MQTT Service (clean rebuild)
 *
 * ONE singleton browser MQTT client, connecting via WebSocket to Mosquitto.
 * Prevents duplicate clients under React StrictMode by guarding on any
 * non-null client reference.
 *
 * Topics subscribed:
 *   aquanova/sensors          — ESP32 JSON payload
 *   aquanova/status/feeder    — plain string: READY | FEEDING | COMPLETED | ERROR
 *
 * Topic published:
 *   aquanova/commands/feeder  — plain string: FEED
 */

import mqtt, { type MqttClient } from 'mqtt';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Raw sensor values received directly from ESP32 via MQTT. No transforms. */
export interface MqttSensorPayload {
  temperature: number;
  ph: number;
  turbidity: number;
  dissolvedOxygen: number;
  waterLevel: number;
}

export interface CameraStatusPayload {
  status: 'online' | 'offline';
  ip?: string;
  stream_url?: string;
  capture_url?: string;
  model?: string;
  resolution?: string;
  flash?: boolean;
}

export type FeederStatus = 'READY' | 'FEEDING' | 'COMPLETED' | 'ERROR' | null;

export type MqttConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

// ── Topics ────────────────────────────────────────────────────────────────────

export const TOPICS = {
  SENSORS:        'aquanova/sensors',
  FEEDER_COMMAND: 'aquanova/commands/feeder',
  FEEDER_STATUS:  'aquanova/status/feeder',
  CAMERA_STATUS:  'aquanova/camera/status',
  CAMERA_COMMAND: 'aquanova/commands/camera',
} as const;

// ── Callback registries ───────────────────────────────────────────────────────

type StatusCb  = (s: MqttConnectionStatus) => void;
type SensorCb  = (d: MqttSensorPayload) => void;
type FeederCb  = (s: FeederStatus) => void;
type CameraCb  = (c: CameraStatusPayload) => void;

const statusListeners = new Set<StatusCb>();
const sensorListeners = new Set<SensorCb>();
const feederListeners = new Set<FeederCb>();
const cameraListeners = new Set<CameraCb>();

// ── Singleton state ───────────────────────────────────────────────────────────

let client: MqttClient | null = null;
let currentStatus: MqttConnectionStatus = 'disconnected';
let lastSensorPayload: MqttSensorPayload | null = null;
let lastFeederStatus: FeederStatus = null;
let lastCameraPayload: CameraStatusPayload | null = null;

function emitStatus(s: MqttConnectionStatus) {
  currentStatus = s;
  statusListeners.forEach((cb) => {
    try { cb(s); } catch (e) { console.error('[MQTT] Status callback error:', e); }
  });
}

function emitSensor(d: MqttSensorPayload) {
  lastSensorPayload = d;
  sensorListeners.forEach((cb) => {
    try { cb(d); } catch (e) { console.error('[MQTT] Sensor callback error:', e); }
  });
}

function emitFeeder(s: FeederStatus) {
  lastFeederStatus = s;
  feederListeners.forEach((cb) => {
    try { cb(s); } catch (e) { console.error('[MQTT] Feeder callback error:', e); }
  });
}

function emitCamera(c: CameraStatusPayload) {
  lastCameraPayload = c;
  cameraListeners.forEach((cb) => {
    try { cb(c); } catch (e) { console.error('[MQTT] Camera callback error:', e); }
  });
}

// ── Payload parsing ───────────────────────────────────────────────────────────

/**
 * Decode a raw MQTT payload to a UTF-8 string.
 * Handles string, Buffer (.toString('utf8')), and Uint8Array (TextDecoder).
 */
export function decodePayload(payload: unknown): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();

  // Try .toString('utf8') if Buffer or custom binary
  if (typeof (payload as any).toString === 'function') {
    try {
      const str = (payload as any).toString('utf8');
      if (str && typeof str === 'string' && !str.startsWith('[object ')) {
        return str.trim();
      }
    } catch {}
  }

  // TextDecoder for Uint8Array or ArrayBuffer
  try {
    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
      return new TextDecoder('utf-8').decode(payload).trim();
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(payload as any)).trim();
  } catch {
    return String(payload).trim();
  }
}

/**
 * Parse and validate a raw JSON string as an MqttSensorPayload.
 * Robust against doubly-stringified payloads, snake_case vs camelCase, and numeric strings.
 */
export function parseSensorPayload(raw: string): MqttSensorPayload | null {
  if (!raw) return null;
  let obj: Record<string, unknown> | null = null;

  try {
    let str = raw.trim();

    // Clean up escaped quotes from shell commands like {\"key\": value}
    if (str.includes('\\"')) {
      str = str.replace(/\\"/g, '"');
    }

    // Handle double-encoded JSON if published with outer quotes
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      try {
        const unquoted = JSON.parse(str);
        if (typeof unquoted === 'string') str = unquoted.trim();
        else if (typeof unquoted === 'object' && unquoted !== null) {
          obj = unquoted as Record<string, unknown>;
        }
      } catch {}
    }

    if (!obj) {
      const parsed = JSON.parse(str);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn('[MQTT] Parsed JSON is not an object:', parsed);
        return null;
      }
      obj = parsed as Record<string, unknown>;
    }
  } catch (err) {
    console.warn('[MQTT] JSON parse failed on raw string:', raw, err);
    return null;
  }

  const num = (...keys: string[]): number | null => {
    for (const key of keys) {
      const v = obj![key];
      if (v !== undefined && v !== null && v !== '') {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  };

  const temperature     = num('temperature', 'temp', 't');
  const ph              = num('ph', 'pH');
  const turbidity       = num('turbidity', 'turb');
  const dissolvedOxygen = num('dissolvedOxygen', 'dissolved_oxygen', 'do', 'DO');
  const waterLevel      = num('waterLevel', 'water_level', 'level', 'wl');

  // Require all five fields
  if (
    temperature === null ||
    ph === null ||
    turbidity === null ||
    dissolvedOxygen === null ||
    waterLevel === null
  ) {
    console.warn('[MQTT] Sensor payload missing required fields or non-numeric values:', obj);
    return null;
  }

  return { temperature, ph, turbidity, dissolvedOxygen, waterLevel };
}

export function parseFeederStatus(raw: string): FeederStatus {
  const upper = raw.trim().toUpperCase();
  if (upper === 'READY' || upper === 'FEEDING' || upper === 'COMPLETED' || upper === 'ERROR') {
    return upper as FeederStatus;
  }
  return null;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

function subscribeTopics(c: MqttClient) {
  if (!c.connected) return;

  c.subscribe(TOPICS.SENSORS, { qos: 1 }, (err) => {
    if (err) {
      console.error('[MQTT] Failed to subscribe to', TOPICS.SENSORS, err);
    } else {
      console.log('[MQTT] Successfully subscribed to topic:', TOPICS.SENSORS);
    }
  });

  c.subscribe(TOPICS.FEEDER_STATUS, { qos: 1 }, (err) => {
    if (err) {
      console.error('[MQTT] Failed to subscribe to', TOPICS.FEEDER_STATUS, err);
    } else {
      console.log('[MQTT] Successfully subscribed to topic:', TOPICS.FEEDER_STATUS);
    }
  });

  c.subscribe(TOPICS.CAMERA_STATUS, { qos: 1 }, (err) => {
    if (err) {
      console.error('[MQTT] Failed to subscribe to', TOPICS.CAMERA_STATUS, err);
    } else {
      console.log('[MQTT] Successfully subscribed to topic:', TOPICS.CAMERA_STATUS);
    }
  });
}

// ── Connection ────────────────────────────────────────────────────────────────

/**
 * Connect to Mosquitto over WebSocket.
 * GUARD: if `client` is non-null, this is idempotent.
 */
export function connectMQTT(): void {
  if (client !== null) {
    if (client.connected) {
      subscribeTopics(client);
    }
    return;
  }

  const url = import.meta.env.VITE_MQTT_URL || 'ws://localhost:9001';
  console.log('[MQTT] Connecting to broker at:', url);

  emitStatus('connecting');

  client = mqtt.connect(url, {
    clientId:        `aquanova-web-${Math.random().toString(16).slice(2, 10)}`,
    clean:           true,
    reconnectPeriod: 3000,
    connectTimeout:  10_000,
    keepalive:       60,
  });

  client.on('connect', () => {
    console.log('[MQTT] Connected successfully to Mosquitto WebSocket');
    emitStatus('connected');
    subscribeTopics(client!);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting to broker...');
    // Do not let a packet from the previous connection look live while the
    // broker is reconnecting. The UI will use its fallback until a fresh,
    // validated ESP32 payload arrives on this connection.
    lastSensorPayload = null;
    emitStatus('reconnecting');
  });

  client.on('offline', () => {
    console.log('[MQTT] Broker went offline');
    lastSensorPayload = null;
    emitStatus('disconnected');
  });

  client.on('error', (err) => {
    console.warn('[MQTT] Error event:', err.message);
    lastSensorPayload = null;
    emitStatus('error');
  });

  client.on('message', (topic: string, payload: unknown) => {
    const raw = decodePayload(payload);
    console.log('[MQTT] Message arrived on topic:', topic, 'payload:', raw);

    const normTopic = topic.trim().toLowerCase();
    const sensorTopic = TOPICS.SENSORS.toLowerCase();
    const feederTopic = TOPICS.FEEDER_STATUS.toLowerCase();
    const cameraTopic = TOPICS.CAMERA_STATUS.toLowerCase();

    if (normTopic === sensorTopic || normTopic.endsWith('/sensors')) {
      const data = parseSensorPayload(raw);
      if (data) {
        console.log('[MQTT] Dispatching live sensor payload:', data);
        emitSensor(data);
      }
      return;
    }

    if (normTopic === feederTopic || normTopic.endsWith('/status/feeder')) {
      const status = parseFeederStatus(raw);
      if (status) {
        console.log('[MQTT] Dispatching feeder status:', status);
        emitFeeder(status);
      } else {
        console.warn('[MQTT] Unknown feeder status ignored:', raw);
      }
      return;
    }

    if (normTopic === cameraTopic || normTopic.endsWith('/camera/status')) {
      try {
        const camData = JSON.parse(raw);
        console.log('[MQTT] Dispatching camera status:', camData);
        emitCamera(camData);
      } catch (e) {
        console.warn('[MQTT] Could not parse camera status JSON:', raw);
      }
      return;
    }
  });
}

/**
 * Gracefully disconnect and reset the singleton.
 */
export function disconnectMQTT(): void {
  if (client) {
    client.end(true);
    client = null;
    emitStatus('disconnected');
  }
}

// ── Publishing ────────────────────────────────────────────────────────────────

/**
 * Send a FEED command to the ESP32 servo with calibrated motor cycles.
 * Logic:
 *  5g  = 1 motor cycle
 *  10g = 2 motor cycles
 *  15g = 3 motor cycles
 *  Each +5g = +1 cycle
 */
export function publishFeederCommand(cyclesOrGrams?: number | { cycles?: number; grams?: number }): void {
  if (!client || !client.connected) {
    console.warn('[MQTT] Cannot publish FEED — not connected to broker.');
    return;
  }

  let cycles = 1;
  let grams = 5;

  if (typeof cyclesOrGrams === 'number') {
    if (cyclesOrGrams >= 5 && cyclesOrGrams % 5 === 0) {
      grams = cyclesOrGrams;
      cycles = Math.max(1, Math.round(grams / 5));
    } else if (cyclesOrGrams >= 5) {
      grams = cyclesOrGrams;
      cycles = Math.max(1, Math.round(grams / 5));
    } else {
      cycles = Math.max(1, Math.round(cyclesOrGrams));
      grams = cycles * 5;
    }
  } else if (cyclesOrGrams && typeof cyclesOrGrams === 'object') {
    if (cyclesOrGrams.cycles !== undefined) {
      cycles = Math.max(1, Math.round(cyclesOrGrams.cycles));
      grams = cyclesOrGrams.grams !== undefined ? cyclesOrGrams.grams : cycles * 5;
    } else if (cyclesOrGrams.grams !== undefined) {
      grams = cyclesOrGrams.grams;
      cycles = Math.max(1, Math.round(grams / 5));
    }
  }

  const payload = JSON.stringify({
    action: 'FEED',
    cycles,
    grams,
    timestamp: new Date().toISOString(),
  });

  console.log(`[MQTT] 🚀 Publishing feeder command: ${payload} (${cycles} cycle(s), ${grams}g)`);
  client.publish(TOPICS.FEEDER_COMMAND, payload, { qos: 1, retain: false });
}

/** Send a command to the ESP32-CAM (e.g. FLASH_ON, FLASH_OFF, FLASH_TOGGLE). */
export function publishCameraCommand(command: string): void {
  if (!client || !client.connected) {
    console.warn('[MQTT] Cannot publish camera command — not connected.');
    return;
  }
  client.publish(TOPICS.CAMERA_COMMAND, command, { qos: 1, retain: false });
}

// ── Getters ───────────────────────────────────────────────────────────────────

export function getMQTTStatus(): MqttConnectionStatus {
  return currentStatus;
}

export function getLatestSensorData(): MqttSensorPayload | null {
  return lastSensorPayload;
}

export function getLatestFeederStatus(): FeederStatus {
  return lastFeederStatus;
}

export function getLatestCameraStatus(): CameraStatusPayload | null {
  return lastCameraPayload;
}

// ── Listener registration ─────────────────────────────────────────────────────

export function onMQTTStatusChange(cb: StatusCb): () => void {
  statusListeners.add(cb);
  cb(currentStatus);
  return () => statusListeners.delete(cb);
}

export function onSensorData(cb: SensorCb): () => void {
  sensorListeners.add(cb);
  if (lastSensorPayload !== null) {
    cb(lastSensorPayload);
  }
  return () => sensorListeners.delete(cb);
}

export function onFeederStatus(cb: FeederCb): () => void {
  feederListeners.add(cb);
  if (lastFeederStatus !== null) {
    cb(lastFeederStatus);
  }
  return () => feederListeners.delete(cb);
}

export function onCameraStatus(cb: CameraCb): () => void {
  cameraListeners.add(cb);
  if (lastCameraPayload !== null) {
    cb(lastCameraPayload);
  }
  return () => cameraListeners.delete(cb);
}
