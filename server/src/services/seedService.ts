import SensorReading from '../models/SensorReading.js';
import Feeding from '../models/Feeding.js';
import Alert from '../models/Alert.js';
import AIAnalysis from '../models/AIAnalysis.js';
import { isDBConnected } from '../config/db.js';
import { seedInMemoryStore } from './storeService.js';

export async function seedDemoDataForDevice(deviceId: string) {
  // Always seed in-memory store first
  seedInMemoryStore(deviceId);

  if (!isDBConnected) return;

  try {
    const existingReadingsCount = await SensorReading.countDocuments({ deviceId });
    if (existingReadingsCount > 0) return;

    console.log(`[SeedService] Seeding initial MongoDB data for device: ${deviceId}`);

    const now = Date.now();
    const readings = [];
    for (let i = 24; i >= 0; i--) {
      const timestamp = new Date(now - i * 3600 * 1000);
      const tempVariation = Math.sin(i / 3) * 0.8 + Math.random() * 0.4;
      const phVariation = Math.cos(i / 4) * 0.15 + Math.random() * 0.05;
      const wlVariation = Math.random() * 2 - 1;

      readings.push({
        deviceId,
        temperature: Number((26.5 + tempVariation).toFixed(1)),
        ph: Number((7.2 + phVariation).toFixed(2)),
        waterLevel: Math.min(100, Math.max(0, Math.round(82 + wlVariation))),
        otherSensorValues: {
          dissolvedOxygen: Number((6.8 + Math.random() * 0.4).toFixed(2)),
          turbidity: Number((3.2 + Math.random() * 0.5).toFixed(1)),
          ammonia: Number((0.02 + Math.random() * 0.01).toFixed(3)),
        },
        timestamp,
      });
    }
    await SensorReading.insertMany(readings);

    await Feeding.insertMany([
      { deviceId, scheduledTime: '08:00', feedAmount: 10, status: 'completed', triggerType: 'scheduled', enabled: true },
      { deviceId, scheduledTime: '13:00', feedAmount: 8, status: 'completed', triggerType: 'scheduled', enabled: true },
      { deviceId, scheduledTime: '18:00', feedAmount: 12, status: 'scheduled', triggerType: 'scheduled', enabled: true },
    ]);

    await Alert.insertMany([
      {
        deviceId,
        type: 'ph_alert',
        severity: 'warning',
        message: 'pH level fluctuated slightly above target threshold (7.45 pH). Automatic buffer adjustment suggested.',
        timestamp: new Date(now - 4 * 3600 * 1000),
        resolved: false,
      },
      {
        deviceId,
        type: 'water_level',
        severity: 'info',
        message: 'Top-off pump executed 2-minute cycle successfully.',
        timestamp: new Date(now - 12 * 3600 * 1000),
        resolved: true,
      },
    ]);

    await AIAnalysis.create({
      deviceId,
      healthScore: 94,
      prediction: 'Water parameters are stable. Aquatic environment health index is high.',
      anomalies: [
        { source: 'pH Sensor', description: 'Minor afternoon pH surge detected', severity: 'low', detected_at: new Date(now - 4 * 3600 * 1000) },
      ],
      recommendations: [
        { level: 'info', message: 'Maintain current feeding schedule of 30g total daily.' },
        { level: 'action', message: 'Inspect water filter sponge during next weekly maintenance.' },
      ],
    });
  } catch (err) {
    console.error(`[SeedService Error]: ${(err as Error).message}`);
  }
}
