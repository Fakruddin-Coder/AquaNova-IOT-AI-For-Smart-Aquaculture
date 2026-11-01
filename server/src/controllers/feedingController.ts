import { Request, Response } from 'express';
import Feeding from '../models/Feeding.js';
import { isDBConnected } from '../config/db.js';
import { memoryStore, seedInMemoryStore, InMemFeeding } from '../services/storeService.js';
import { dispatchFeederCommand } from '../services/feederScheduler.js';

export const getFeedingByDevice = async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    seedInMemoryStore(deviceId);

    let allItems: any[] = [];

    if (isDBConnected) {
      try {
        allItems = await Feeding.find({ deviceId }).lean();
      } catch (e) {}
    }

    if (allItems.length === 0) {
      allItems = memoryStore.feedings.get(deviceId) || [];
    }

    const schedules = allItems
      .filter((s: any) => (s.status === 'scheduled' || !s.status) && s.triggerType !== 'manual')
      .sort((a: any, b: any) => String(a.scheduledTime || '').localeCompare(String(b.scheduledTime || '')));

    const history = allItems
      .filter((s: any) => s.status === 'completed' || s.triggerType === 'manual')
      .sort((a: any, b: any) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

    return res.json({
      schedules,
      history,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch feeding data' });
  }
};

export const createFeeding = async (req: Request, res: Response) => {
  try {
    const { deviceId, scheduledTime, feedAmount, status, triggerType, enabled, frequency, customDays } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const devId = deviceId as string;
    seedInMemoryStore(devId);

    const isCompletedOrManual = status === 'completed' || triggerType === 'manual';
    const isEnabled = isCompletedOrManual ? false : (enabled !== false);
    const grams = feedAmount !== undefined ? Math.max(1, Number(feedAmount)) : 5;

    const nowStr = new Date().toISOString();
    const feedingData: InMemFeeding = {
      _id: 'f_' + Date.now(),
      deviceId: devId,
      scheduledTime: scheduledTime || '12:00',
      feedAmount: grams,
      status: status || 'scheduled',
      triggerType: triggerType || 'scheduled',
      enabled: isEnabled,
      frequency: frequency || 'daily',
      customDays: Array.isArray(customDays) ? customDays : [],
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    if (isDBConnected) {
      try {
        const created = await Feeding.create({
          deviceId: devId,
          scheduledTime: feedingData.scheduledTime,
          feedAmount: feedingData.feedAmount,
          status: feedingData.status,
          triggerType: feedingData.triggerType,
          enabled: feedingData.enabled,
          frequency: feedingData.frequency,
          customDays: feedingData.customDays,
        });
        feedingData._id = created._id.toString();
      } catch (e) {}
    }

    const currentFeedings = memoryStore.feedings.get(devId) || [];
    memoryStore.feedings.set(devId, [...currentFeedings, feedingData]);

    // If this was a manual feed command, also dispatch immediately to ESP32 hardware via MQTT
    if (isCompletedOrManual) {
      const cycles = Math.max(1, Math.round(grams / 5));
      dispatchFeederCommand(cycles, grams, 'manual', devId);
    }

    return res.status(201).json(feedingData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create feeding record' });
  }
};

export const updateFeeding = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduledTime, feedAmount, status, enabled, frequency, customDays } = req.body;

    let updatedFeeding: any = null;

    if (isDBConnected) {
      try {
        const updateData: any = {};
        if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
        if (feedAmount !== undefined) updateData.feedAmount = Number(feedAmount);
        if (status !== undefined) updateData.status = status;
        if (enabled !== undefined) updateData.enabled = enabled;
        if (frequency !== undefined) updateData.frequency = frequency;
        if (customDays !== undefined) updateData.customDays = customDays;

        updatedFeeding = await Feeding.findByIdAndUpdate(id, updateData, { new: true });
      } catch (e) {}
    }

    // Update in-memory store
    memoryStore.feedings.forEach((schedules, devId) => {
      const idx = schedules.findIndex((s) => s._id === id || (s as any).id === id);
      if (idx !== -1) {
        if (scheduledTime !== undefined) schedules[idx].scheduledTime = scheduledTime;
        if (feedAmount !== undefined) schedules[idx].feedAmount = Number(feedAmount);
        if (status !== undefined) schedules[idx].status = status;
        if (enabled !== undefined) schedules[idx].enabled = enabled;
        if (frequency !== undefined) schedules[idx].frequency = frequency;
        if (customDays !== undefined) schedules[idx].customDays = customDays;
        schedules[idx].updatedAt = new Date().toISOString();
        updatedFeeding = schedules[idx];
      }
    });

    if (!updatedFeeding) {
      return res.status(404).json({ error: 'Feeding record not found' });
    }

    return res.json(updatedFeeding);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update feeding record' });
  }
};

export const clearFeedingHistory = async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    if (isDBConnected) {
      try {
        await Feeding.deleteMany({
          deviceId,
          $or: [{ status: 'completed' }, { triggerType: 'manual' }],
        });
      } catch (e) {}
    }

    // Filter in-memory store
    const memList = memoryStore.feedings.get(deviceId) || [];
    const remaining = memList.filter(
      (f) => (f.status === 'scheduled' || !f.status) && f.triggerType !== 'manual'
    );
    memoryStore.feedings.set(deviceId, remaining);

    return res.json({ message: 'Feeding history cleared successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to clear feeding history' });
  }
};

export const deleteFeeding = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let deleted = false;

    if (isDBConnected) {
      try {
        const resObj = await Feeding.findByIdAndDelete(id);
        if (resObj) deleted = true;
      } catch (e) {}
    }

    memoryStore.feedings.forEach((schedules, devId) => {
      const filtered = schedules.filter((s) => s._id !== id && (s as any).id !== id);
      if (filtered.length !== schedules.length) {
        memoryStore.feedings.set(devId, filtered);
        deleted = true;
      }
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Feeding record not found' });
    }

    return res.json({ message: 'Feeding record deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete feeding record' });
  }
};
