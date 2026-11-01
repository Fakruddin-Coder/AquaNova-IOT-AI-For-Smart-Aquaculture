/**
 * AquaNova — MQTT React Context (clean rebuild)
 *
 * Single source of truth for live MQTT state.
 * Mount <MqttProvider> once (App.tsx wraps the DeviceProvider).
 * Read with useMqtt() in any component.
 *
 * Exposed values:
 *   mqttStatus      — broker connection state
 *   liveSensorData  — EXACT latest payload from ESP32 (or null if never received)
 *   feederStatus    — last feeder state from ESP32 (or null)
 *   publishFeed()   — send FEED command to ESP32
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  connectMQTT,
  publishFeederCommand,
  onMQTTStatusChange,
  onSensorData,
  onFeederStatus,
  getMQTTStatus,
  getLatestSensorData,
  getLatestFeederStatus,
  getLatestCameraStatus,
  publishCameraCommand,
  onCameraStatus,
  type MqttConnectionStatus,
  type MqttSensorPayload,
  type FeederStatus,
  type CameraStatusPayload,
} from '@/services/mqtt';

// ── Context shape ─────────────────────────────────────────────────────────────

interface MqttContextValue {
  /** Current broker connection state. */
  mqttStatus: MqttConnectionStatus;
  /**
   * The EXACT latest sensor payload received from the ESP32 over MQTT.
   * null = no message has been received yet in this session.
   * Never mixed with REST data, defaults, or previous readings.
   */
  liveSensorData: MqttSensorPayload | null;
  /** Latest feeder state reported by the ESP32. */
  feederStatus: FeederStatus;
  /** Publish a FEED command to the ESP32 servo via MQTT. */
  publishFeed: (cyclesOrGrams?: number | { cycles?: number; grams?: number }) => void;
  /** Latest camera state reported by the ESP32-CAM (or null). */
  cameraPayload: CameraStatusPayload | null;
  /** Send command to the ESP32-CAM (FLASH_ON, FLASH_OFF, FLASH_TOGGLE). */
  publishCamera: (cmd: string) => void;
  /** Active sensor data — live ESP32 values OR mock fallback. Always non-null. */
  activeSensorData: MqttSensorPayload;
  /** True when falling back to mock data (MQTT disconnected / no live reading yet). */
  isUsingMockData: boolean;
}

const MOCK_SENSOR_DATA: MqttSensorPayload = {
  temperature: 26.5,
  ph: 7.2,
  turbidity: 3.2,
  dissolvedOxygen: 6.8,
  waterLevel: 85,
};

const MqttContext = createContext<MqttContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function MqttProvider({ children }: { children: ReactNode }) {
  const [mqttStatus,     setMqttStatus]     = useState<MqttConnectionStatus>(getMQTTStatus);
  const [liveSensorData, setLiveSensorData] = useState<MqttSensorPayload | null>(getLatestSensorData);
  const [feederStatus,   setFeederStatus]   = useState<FeederStatus>(getLatestFeederStatus);
  const [cameraPayload,  setCameraPayload]  = useState<CameraStatusPayload | null>(getLatestCameraStatus);

  useEffect(() => {
    // Connect the singleton client (idempotent)
    connectMQTT();

    // Register per-render listener instances (they immediately get current values if present)
    const unsubStatus  = onMQTTStatusChange((status) => {
      setMqttStatus(status);
      // A reconnect is not live telemetry. Keep the demo packet active until
      // the next valid sensor message is received.
      if (status !== 'connected') setLiveSensorData(null);
    });
    const unsubSensor  = onSensorData((data) => {
      console.log('[MqttContext] liveSensorData updated in React Context:', data);
      setLiveSensorData(data);
    });
    const unsubFeeder  = onFeederStatus(setFeederStatus);
    const unsubCamera  = onCameraStatus(setCameraPayload);

    return () => {
      unsubStatus();
      unsubSensor();
      unsubFeeder();
      unsubCamera();
      // Notice: Do NOT disconnect the singleton client on component unmount
      // to keep connection alive across React StrictMode & route transitions.
    };
  }, []);

  const publishFeed = useCallback((cyclesOrGrams?: number | { cycles?: number; grams?: number }) => {
    publishFeederCommand(cyclesOrGrams);
  }, []);

  const publishCamera = useCallback((cmd: string) => {
    publishCameraCommand(cmd);
  }, []);

  const isUsingMockData = mqttStatus !== 'connected' || !liveSensorData;
  const activeSensorData = isUsingMockData ? MOCK_SENSOR_DATA : liveSensorData;

  return (
    <MqttContext.Provider value={{
      mqttStatus,
      liveSensorData,
      activeSensorData,
      isUsingMockData,
      feederStatus,
      publishFeed,
      cameraPayload,
      publishCamera,
    }}>
      {children}
    </MqttContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access live MQTT state from any component inside <MqttProvider>.
 */
export function useMqtt(): MqttContextValue {
  const ctx = useContext(MqttContext);
  if (!ctx) throw new Error('useMqtt must be used inside MqttProvider');
  return ctx;
}
