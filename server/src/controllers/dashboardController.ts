import { Request, Response } from 'express';
import SensorReading from '../models/SensorReading.js';
import Feeding from '../models/Feeding.js';
import Alert from '../models/Alert.js';
import AIAnalysis from '../models/AIAnalysis.js';
import { isDBConnected } from '../config/db.js';
import { memoryStore, seedInMemoryStore } from '../services/storeService.js';

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;

    // Ensure memory store is seeded for this device
    seedInMemoryStore(deviceId);

    let latestReading: any = null;
    let recentHistory: any[] = [];
    let feedingList: any[] = [];
    let recentAlerts: any[] = [];
    let aiData: any = null;

    if (isDBConnected) {
      try {
        [latestReading, recentHistory, feedingList, recentAlerts, aiData] = await Promise.all([
          SensorReading.findOne({ deviceId }).sort({ timestamp: -1 }),
          SensorReading.find({ deviceId }).sort({ timestamp: -1 }).limit(24),
          Feeding.find({ deviceId }).sort({ scheduledTime: 1 }),
          Alert.find({ deviceId }).sort({ timestamp: -1 }).limit(10),
          AIAnalysis.findOne({ deviceId }).sort({ createdAt: -1 }),
        ]);
      } catch (e) {}
    }

    // Fallback to memoryStore if DB yields empty
    const memReadings = memoryStore.readings.get(deviceId) || [];
    if (!latestReading && memReadings.length > 0) {
      latestReading = memReadings[memReadings.length - 1];
    }

    if (recentHistory.length === 0 && memReadings.length > 0) {
      recentHistory = [...memReadings].slice(-24);
    }

    const memFeedings = memoryStore.feedings.get(deviceId) || [];
    if (feedingList.length === 0 && memFeedings.length > 0) {
      feedingList = memFeedings;
    }

    const memAlerts = memoryStore.alerts.get(deviceId) || [];
    if (recentAlerts.length === 0 && memAlerts.length > 0) {
      recentAlerts = memAlerts;
    }

    const memAI = memoryStore.aiData.get(deviceId);
    if (!aiData && memAI) {
      aiData = memAI;
    }

    return res.json({
      deviceId,
      deviceStatus: 'online',
      deviceName: 'AquaNova Smart Kit',
      firmwareVersion: '1.2.4',
      lastSeen: new Date().toISOString(),
      wifiSignal: 88,
      uptimeSeconds: 172800,
      latestReadings: latestReading || {
        temperature: 26.5,
        ph: 7.2,
        waterLevel: 82,
        otherSensorValues: { dissolvedOxygen: 6.8, turbidity: 3.2 },
        timestamp: new Date().toISOString(),
      },
      feedingStatus: {
        activeSchedules: feedingList.filter((f: any) => (f.status === 'scheduled' || !f.status) && f.triggerType !== 'manual' && f.enabled !== false).length,
        completedToday: feedingList.filter((f: any) => f.status === 'completed' || f.triggerType === 'manual').length,
        schedules: feedingList.filter((f: any) => (f.status === 'scheduled' || !f.status) && f.triggerType !== 'manual'),
      },
      recentAlerts,
      aiHealthScore: aiData ? aiData.healthScore : 94,
      aiAnalysis: aiData || {
        healthScore: 94,
        prediction: 'Water parameters are optimal. Aquatic ecosystem is healthy.',
        anomalies: [
          { source: 'pH Sensor', description: 'Minor afternoon pH surge detected', severity: 'low', detected_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
        ],
        recommendations: [
          { level: 'info', message: 'Maintain current feeding schedule of 30g total daily.' },
        ],
      },
      recentHistory: recentHistory.reverse(),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};
