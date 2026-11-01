import { Request, Response } from 'express';
import SensorReading from '../models/SensorReading.js';
import Device from '../models/Device.js';
import { isDBConnected } from '../config/db.js';
import { memoryStore, seedInMemoryStore, InMemReading } from '../services/storeService.js';

export const createReading = async (req: Request, res: Response) => {
  try {
    const { deviceId, temperature, ph, waterLevel, otherSensorValues } = req.body;

    if (!deviceId || temperature === undefined || ph === undefined || waterLevel === undefined) {
      return res.status(400).json({ error: 'deviceId, temperature, ph, and waterLevel are required' });
    }

    seedInMemoryStore(deviceId);

    const readingData: InMemReading = {
      _id: 'sr_' + Date.now(),
      deviceId,
      temperature: Number(temperature),
      ph: Number(ph),
      waterLevel: Number(waterLevel),
      otherSensorValues: otherSensorValues || {},
      timestamp: new Date().toISOString(),
    };

    if (isDBConnected) {
      try {
        const created = await SensorReading.create({
          deviceId,
          temperature: readingData.temperature,
          ph: readingData.ph,
          waterLevel: readingData.waterLevel,
          otherSensorValues: readingData.otherSensorValues,
          timestamp: new Date(readingData.timestamp),
        });
        readingData._id = created._id.toString();
        await Device.findOneAndUpdate({ deviceId }, { lastSeen: new Date(), status: 'online' });
      } catch (e) {}
    }

    const current = memoryStore.readings.get(deviceId) || [];
    memoryStore.readings.set(deviceId, [...current, readingData]);

    return res.status(201).json(readingData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to record sensor reading' });
  }
};

export const getLatestReading = async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    seedInMemoryStore(deviceId);

    let reading: any = null;
    if (isDBConnected) {
      try {
        reading = await SensorReading.findOne({ deviceId }).sort({ timestamp: -1 });
      } catch (e) {}
    }

    if (!reading) {
      const readings = memoryStore.readings.get(deviceId) || [];
      if (readings.length > 0) {
        reading = readings[readings.length - 1];
      }
    }

    return res.json(reading);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch latest reading' });
  }
};

export const getReadingHistory = async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    const limit = parseInt(req.query.limit as string) || 100;
    seedInMemoryStore(deviceId);

    let readings: any[] = [];
    if (isDBConnected) {
      try {
        readings = await SensorReading.find({ deviceId }).sort({ timestamp: -1 }).limit(limit);
      } catch (e) {}
    }

    if (readings.length === 0) {
      const memReadings = memoryStore.readings.get(deviceId) || [];
      readings = memReadings.slice(-limit);
    }

    return res.json(readings);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch reading history' });
  }
};
