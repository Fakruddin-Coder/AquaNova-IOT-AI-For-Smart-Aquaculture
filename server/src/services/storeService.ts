export interface InMemReading {
  _id: string;
  deviceId: string;
  temperature: number;
  ph: number;
  waterLevel: number;
  otherSensorValues?: {
    dissolvedOxygen?: number;
    turbidity?: number;
    ammonia?: number;
  };
  timestamp: string;
}

export interface InMemFeeding {
  _id: string;
  deviceId: string;
  scheduledTime: string;
  feedAmount: number;
  status: string;
  triggerType: string;
  enabled: boolean;
  frequency?: 'once' | 'daily' | 'custom';
  customDays?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface InMemAlert {
  _id: string;
  deviceId: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface InMemAI {
  _id: string;
  deviceId: string;
  healthScore: number;
  prediction: string;
  anomalies: any[];
  recommendations: any[];
  createdAt: string;
}

// Global shared in-memory collections
export const memoryStore = {
  readings: new Map<string, InMemReading[]>(), // deviceId -> InMemReading[]
  feedings: new Map<string, InMemFeeding[]>(), // deviceId -> InMemFeeding[]
  alerts: new Map<string, InMemAlert[]>(),     // deviceId -> InMemAlert[]
  aiData: new Map<string, InMemAI>(),           // deviceId -> InMemAI
};

export function seedInMemoryStore(deviceId: string) {
  if (!memoryStore.readings.has(deviceId)) {
    const now = Date.now();
    const readings: InMemReading[] = [];
    for (let i = 24; i >= 0; i--) {
      const ts = new Date(now - i * 3600 * 1000).toISOString();
      const tempVariation = Math.sin(i / 3) * 0.8 + Math.random() * 0.4;
      const phVariation = Math.cos(i / 4) * 0.15 + Math.random() * 0.05;
      readings.push({
        _id: `sr_${deviceId}_${i}`,
        deviceId,
        temperature: Number((26.5 + tempVariation).toFixed(1)),
        ph: Number((7.2 + phVariation).toFixed(2)),
        waterLevel: Math.min(100, Math.max(0, Math.round(82 + (Math.random() * 2 - 1)))),
        otherSensorValues: {
          dissolvedOxygen: Number((6.8 + Math.random() * 0.4).toFixed(2)),
          turbidity: Number((3.2 + Math.random() * 0.5).toFixed(1)),
          ammonia: Number((0.02 + Math.random() * 0.01).toFixed(3)),
        },
        timestamp: ts,
      });
    }
    memoryStore.readings.set(deviceId, readings);
  }

  if (!memoryStore.feedings.has(deviceId)) {
    const nowStr = new Date().toISOString();
    memoryStore.feedings.set(deviceId, [
      { _id: `f1_${deviceId}`, deviceId, scheduledTime: '08:00', feedAmount: 10, status: 'completed', triggerType: 'scheduled', enabled: true, createdAt: nowStr, updatedAt: nowStr },
      { _id: `f2_${deviceId}`, deviceId, scheduledTime: '13:00', feedAmount: 8, status: 'completed', triggerType: 'scheduled', enabled: true, createdAt: nowStr, updatedAt: nowStr },
      { _id: `f3_${deviceId}`, deviceId, scheduledTime: '18:00', feedAmount: 12, status: 'scheduled', triggerType: 'scheduled', enabled: true, createdAt: nowStr, updatedAt: nowStr },
    ]);
  }

  if (!memoryStore.alerts.has(deviceId)) {
    const now = Date.now();
    memoryStore.alerts.set(deviceId, [
      {
        _id: `a1_${deviceId}`,
        deviceId,
        type: 'ph_alert',
        severity: 'warning',
        message: 'pH level fluctuated slightly above target threshold (7.45 pH). Automatic buffer adjustment suggested.',
        timestamp: new Date(now - 4 * 3600 * 1000).toISOString(),
        resolved: false,
      },
      {
        _id: `a2_${deviceId}`,
        deviceId,
        type: 'water_level',
        severity: 'info',
        message: 'Top-off pump executed 2-minute cycle successfully.',
        timestamp: new Date(now - 12 * 3600 * 1000).toISOString(),
        resolved: true,
      },
    ]);
  }

  if (!memoryStore.aiData.has(deviceId)) {
    const now = Date.now();
    memoryStore.aiData.set(deviceId, {
      _id: `ai_${deviceId}`,
      deviceId,
      healthScore: 94,
      prediction: 'Water parameters are stable. Aquatic environment health index is high.',
      anomalies: [
        { source: 'pH Sensor', description: 'Minor afternoon pH surge detected', severity: 'low', detected_at: new Date(now - 4 * 3600 * 1000).toISOString() },
      ],
      recommendations: [
        { level: 'info', message: 'Maintain current feeding schedule of 30g total daily.' },
        { level: 'action', message: 'Inspect water filter sponge during next weekly maintenance.' },
      ],
      createdAt: new Date().toISOString(),
    });
  }
}
