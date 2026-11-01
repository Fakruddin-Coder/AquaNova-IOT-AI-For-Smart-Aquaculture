import { Response } from 'express';
import mongoose from 'mongoose';
import Device from '../models/Device.js';
import User from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';
import { seedDemoDataForDevice } from '../services/seedService.js';
import { isDBConnected } from '../config/db.js';

const inMemoryDevices = new Map<string, any>();

export const createDevice = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin') {
      const account = isDBConnected ? await User.findById(req.user.id).select('role kitPurchased') : null;
      if (account?.role !== 'admin' && account?.kitPurchased === false) {
        return res.status(403).json({ error: 'Please purchase an AquaNova Kit before adding a device.', code: 'KIT_REQUIRED' });
      }
    }

    const { deviceId, deviceName } = req.body;
    if (!deviceId || !deviceName) {
      return res.status(400).json({ error: 'deviceId and deviceName are required' });
    }

    if (isDBConnected) {
      try {
        const existing = await Device.findOne({ deviceId });
        if (existing) {
          return res.status(400).json({ error: 'Device with this deviceId is already registered' });
        }
        const device = await Device.create({
          userId: req.user.id,
          deviceId,
          deviceName,
          status: 'online',
          firmwareVersion: '1.2.4',
          lastSeen: new Date(),
        });
        await seedDemoDataForDevice(deviceId);
        return res.status(201).json(device);
      } catch (e) {}
    }

    const dev = {
      _id: 'dev_' + Date.now(),
      userId: req.user.id,
      deviceId,
      deviceName,
      status: 'online',
      firmwareVersion: '1.2.4',
      lastSeen: new Date().toISOString(),
      wifiSignal: 85,
      uptimeSeconds: 86400,
      createdAt: new Date().toISOString(),
    };
    inMemoryDevices.set(deviceId, dev);
    await seedDemoDataForDevice(deviceId);
    return res.status(201).json(dev);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create device' });
  }
};

export const getDevices = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let devices: any[] = [];
    if (isDBConnected) {
      try {
        devices = await Device.find({ userId: req.user.id }).sort({ createdAt: 1 }).lean();
      } catch (e) {}
    }

    if (devices.length === 0 && !isDBConnected) {
      devices = Array.from(inMemoryDevices.values()).filter((d) => d.userId === req.user?.id);
    }

    return res.json(devices);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch devices' });
  }
};

export const getDeviceById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const deviceId = req.params.deviceId as string;

    let device: any = null;
    if (isDBConnected) {
      try {
        device = await Device.findOne({ $or: [{ deviceId }, { _id: deviceId }], userId: req.user.id });
      } catch (e) {}
    }
    if (!device) {
      device = inMemoryDevices.get(deviceId);
    }

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    return res.json(device);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch device' });
  }
};

export const updateDevice = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const deviceId = req.params.deviceId as string;
    const { deviceName, status, firmwareVersion } = req.body;

    const updated = {
      deviceId,
      deviceName: deviceName || 'AquaNova Kit',
      status: status || 'online',
      firmwareVersion: firmwareVersion || '1.2.4',
      lastSeen: new Date().toISOString(),
    };
    inMemoryDevices.set(deviceId, updated);

    if (isDBConnected) {
      try {
        await Device.updateOne(
          { $or: [{ deviceId }, { _id: deviceId }], userId: req.user.id },
          { $set: { deviceName: deviceName || 'AquaNova Kit', status: status || 'online', firmwareVersion: firmwareVersion || '1.2.4' } }
        );
      } catch (e) {}
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update device' });
  }
};

export const deleteDevice = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const deviceId = req.params.deviceId as string;

    inMemoryDevices.delete(deviceId);

    if (isDBConnected) {
      const deleteFilter: any = {
        $or: [
          { deviceId },
          ...(mongoose.isValidObjectId(deviceId) ? [{ _id: deviceId }] : [])
        ]
      };
      if (req.user.role !== 'admin') {
        deleteFilter.userId = req.user.id;
      }

      await Device.deleteMany(deleteFilter);

      // Clean up telemetry and records for this device
      const SensorReadingModel = (await import('../models/SensorReading.js')).default;
      const FeedingModel = (await import('../models/Feeding.js')).default;
      const AlertModel = (await import('../models/Alert.js')).default;
      const OrderModel = (await import('../models/Order.js')).default;

      await SensorReadingModel.deleteMany({ deviceId });
      await FeedingModel.deleteMany({ deviceId });
      await AlertModel.deleteMany({ deviceId });

      // Unset from Order if this was an assigned device code
      await OrderModel.updateMany(
        { assigned_device_code: deviceId },
        { $unset: { assigned_device_code: 1 } }
      );
    }

    return res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Failed to delete device:', error);
    return res.status(500).json({ error: 'Failed to delete device' });
  }
};

