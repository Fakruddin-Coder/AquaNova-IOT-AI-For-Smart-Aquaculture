import { Request, Response } from 'express';
import Alert from '../models/Alert.js';
import { isDBConnected } from '../config/db.js';
import { memoryStore, seedInMemoryStore, InMemAlert } from '../services/storeService.js';

export const getAlertsByDevice = async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    seedInMemoryStore(deviceId);

    let alerts: any[] = [];

    if (isDBConnected) {
      try {
        alerts = await Alert.find({ deviceId }).sort({ timestamp: -1 }).limit(50);
      } catch (e) {}
    }

    if (alerts.length === 0) {
      alerts = memoryStore.alerts.get(deviceId) || [];
    }

    return res.json(alerts);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

export const createAlert = async (req: Request, res: Response) => {
  try {
    const { deviceId, type, severity, message } = req.body;

    if (!deviceId || !message) {
      return res.status(400).json({ error: 'deviceId and message are required' });
    }

    const devId = deviceId as string;
    seedInMemoryStore(devId);

    const alertData: InMemAlert = {
      _id: 'a_' + Date.now(),
      deviceId: devId,
      type: type || 'sensor_alert',
      severity: severity || 'warning',
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    if (isDBConnected) {
      try {
        const created = await Alert.create({
          deviceId: devId,
          type: alertData.type,
          severity: alertData.severity,
          message: alertData.message,
          timestamp: new Date(alertData.timestamp),
          resolved: false,
        });
        alertData._id = created._id.toString();
      } catch (e) {}
    }

    const current = memoryStore.alerts.get(devId) || [];
    memoryStore.alerts.set(devId, [alertData, ...current]);

    return res.status(201).json(alertData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create alert' });
  }
};

export const resolveAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let resolvedAlert: any = null;

    if (isDBConnected) {
      try {
        resolvedAlert = await Alert.findByIdAndUpdate(id, { resolved: true }, { new: true });
      } catch (e) {}
    }

    memoryStore.alerts.forEach((alerts, devId) => {
      const idx = alerts.findIndex((a) => a._id === id || (a as any).id === id);
      if (idx !== -1) {
        alerts[idx].resolved = true;
        resolvedAlert = alerts[idx];
      }
    });

    if (!resolvedAlert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json(resolvedAlert);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to resolve alert' });
  }
};
