/**
 * AquaNova Backend — Automated Feeder Scheduler Service
 *
 * Runs continuously in the background on the Node.js server.
 * Connects directly to the local Mosquitto MQTT broker on port 1884 (or 1883).
 * Checks enabled feeding schedules every 5 seconds and automatically dispatches
 * the "FEED" MQTT command when the scheduled time matches the current local time.
 *
 * SAFETY GUARDS:
 * 1. ONLY queries items with `status: 'scheduled'` and `enabled: true`. Completed logs are NEVER scheduled.
 * 2. Enforces a 60-second hardware cooldown per device to prevent repeat/infinite cycling.
 * 3. Deduplicates triggers by deviceId + scheduledTime + minute timestamp.
 */

import mqtt from 'mqtt';
import Feeding from '../models/Feeding.js';
import { memoryStore, InMemFeeding } from './storeService.js';

let mqttClient: mqtt.MqttClient | null = null;
const triggeredMinutes = new Set<string>();
const lastDeviceTriggerTime = new Map<string, number>();
const deviceCooldownDuration = new Map<string, number>();

/**
 * Normalizes any time string ("14:30", "02:30 PM", "8:00") into { hours: 0-23, minutes: 0-59 }
 */
function parseTimeTo24h(timeStr: string): { hours: number; minutes: number } {
  if (!timeStr || typeof timeStr !== 'string') return { hours: 12, minutes: 0 };
  const upper = timeStr.trim().toUpperCase();
  const hasPM = upper.includes('PM');
  const hasAM = upper.includes('AM');

  const cleaned = upper.replace(/[^\d:]/g, '');
  const [hStr = '12', mStr = '0'] = cleaned.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);

  if (isNaN(h)) h = 12;
  if (isNaN(m)) m = 0;

  if (hasPM && h < 12) h += 12;
  if (hasAM && h === 12) h = 0;

  return {
    hours: Math.max(0, Math.min(23, h)),
    minutes: Math.max(0, Math.min(59, m)),
  };
}

/**
 * Dispatches a FEED command over MQTT with calibrated motor cycles (5g per cycle).
 * Cooldown: 5g = 5s, 10g = 10s, 15g = 15s. Every additional gram adds 1 second.
 */
export function dispatchFeederCommand(
  cyclesOrGrams: number,
  gramsAmount?: number,
  triggerType: 'manual' | 'scheduled' = 'manual',
  deviceId?: string
): boolean {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('[Backend Feeder] Cannot dispatch command: MQTT client not connected to broker');
    return false;
  }

  let cycles = 1;
  let grams = 5;

  if (gramsAmount !== undefined) {
    grams = gramsAmount;
    cycles = Math.max(1, Math.round(grams / 5));
  } else if (cyclesOrGrams >= 5 && cyclesOrGrams % 5 === 0) {
    grams = cyclesOrGrams;
    cycles = Math.max(1, Math.round(grams / 5));
  } else {
    cycles = Math.max(1, Math.round(cyclesOrGrams));
    grams = cycles * 5;
  }

  const devId = deviceId || 'AquaNova-Kit';
  const cooldownMs = Math.max(5, Math.round(grams)) * 1000;
  lastDeviceTriggerTime.set(devId, Date.now());
  deviceCooldownDuration.set(devId, cooldownMs);

  const payload = JSON.stringify({
    action: 'FEED',
    cycles,
    grams,
    triggerType,
    deviceId: devId,
    timestamp: new Date().toISOString(),
  });

  mqttClient.publish('aquanova/commands/feeder', payload, { qos: 1, retain: false }, (err) => {
    if (err) {
      console.error('[Backend Feeder] Failed to publish FEED command:', err);
    } else {
      console.log(`[Backend Feeder] 🚀 Dispatched FEED command (${cycles} cycle(s), ${grams}g, cooldown ${cooldownMs / 1000}s) to aquanova/commands/feeder`);
    }
  });

  return true;
}

export function initFeederScheduler() {
  console.log('[Backend Feeder] Initializing Automated Feeding Scheduler...');

  // Connect to local Mosquitto broker
  const brokerUrl = 'mqtt://127.0.0.1:1884';
  try {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: `AquaNova-Backend-Scheduler-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    mqttClient.on('connect', () => {
      console.log(`[Backend Feeder] Connected to Mosquitto broker on ${brokerUrl}`);
    });

    mqttClient.on('error', (err) => {
      console.warn(`[Backend Feeder] MQTT warning (${brokerUrl}):`, err.message);
    });
  } catch (err: any) {
    console.warn('[Backend Feeder] Failed to connect to MQTT:', err.message);
  }

  // Periodic checker: runs every 5 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDate = now.getDate();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const nowMs = now.getTime();

      // Collect ONLY genuine active schedules (status: 'scheduled' and enabled: true)
      const activeSchedules: Array<{
        id: string;
        deviceId: string;
        time: string;
        amount: number;
        frequency: 'once' | 'daily' | 'custom';
        customDays: number[];
      }> = [];

      // 1. Check MongoDB if connected
      try {
        const dbFeedings = await Feeding.find({
          enabled: true,
          status: 'scheduled',
          triggerType: 'scheduled',
        }).lean();

        if (dbFeedings && dbFeedings.length > 0) {
          for (const f of dbFeedings) {
            activeSchedules.push({
              id: (f._id as any).toString(),
              deviceId: f.deviceId,
              time: f.scheduledTime,
              amount: f.feedAmount || 5,
              frequency: (f.frequency as any) || 'daily',
              customDays: Array.isArray(f.customDays) ? f.customDays : [],
            });
          }
        }
      } catch (e) {
        // DB not connected or query error, fallback to memoryStore
      }

      // 2. Check MemoryStore
      memoryStore.feedings.forEach((list, devId) => {
        list.forEach((f) => {
          if (
            f.enabled === true &&
            f.status === 'scheduled' &&
            f.triggerType === 'scheduled' &&
            !activeSchedules.some((s) => s.id === f._id)
          ) {
            activeSchedules.push({
              id: f._id,
              deviceId: devId,
              time: f.scheduledTime,
              amount: f.feedAmount || 5,
              frequency: f.frequency || 'daily',
              customDays: Array.isArray(f.customDays) ? f.customDays : [],
            });
          }
        });
      });

      // Check each schedule against current time & frequency
      for (const sched of activeSchedules) {
        // Frequency check for custom days
        if (sched.frequency === 'custom') {
          if (!sched.customDays.includes(currentDayOfWeek)) {
            continue; // Not scheduled for today
          }
        }

        const { hours, minutes } = parseTimeTo24h(sched.time);

        if (hours === currentHour && minutes === currentMinute) {
          // Deduplicate key by Device + Scheduled Time + Minute
          const triggerKey = `${sched.deviceId}_${sched.time}_${currentYear}-${currentMonth}-${currentDate}_${currentHour}:${currentMinute}`;

          if (triggeredMinutes.has(triggerKey)) {
            continue; // Already triggered during this minute
          }

          // Dynamic safety Cooldown check based on grams: 5g = 5s, 10g = 10s, 15g = 15s (+1s per gram)
          const grams = sched.amount || 5;
          const requiredCooldownMs = Math.max(5, Math.round(grams)) * 1000;
          const lastTrigger = lastDeviceTriggerTime.get(sched.deviceId) || 0;
          const activeCooldown = deviceCooldownDuration.get(sched.deviceId) || 5000;

          if (nowMs - lastTrigger < activeCooldown) {
            console.log(`[Backend Feeder] ⏳ Cooldown active (${activeCooldown / 1000}s) for device ${sched.deviceId}. Skipping repeat trigger.`);
            continue;
          }

          triggeredMinutes.add(triggerKey);
          lastDeviceTriggerTime.set(sched.deviceId, nowMs);
          deviceCooldownDuration.set(sched.deviceId, requiredCooldownMs);

          const cycles = Math.max(1, Math.round(grams / 5));

          console.log(
            `[Backend Feeder] ⏰ Automated feeding triggered: ${sched.time} (${grams}g -> ${cycles} cycle(s), frequency: ${sched.frequency}) for device: ${sched.deviceId}`
          );

          // Dispatch command to Mosquitto
          dispatchFeederCommand(cycles, grams, 'scheduled', sched.deviceId);

          // If frequency is 'once', deactivate the schedule immediately after execution
          if (sched.frequency === 'once') {
            console.log(`[Backend Feeder] 📴 'Once' schedule ${sched.id} executed. Deactivating.`);
            try {
              await Feeding.findByIdAndUpdate(sched.id, { enabled: false });
            } catch (e) {}

            memoryStore.feedings.forEach((list) => {
              const target = list.find((s) => s._id === sched.id || (s as any).id === sched.id);
              if (target) target.enabled = false;
            });
          }

          // Record completed feeding event in history (DISABLED so it will NEVER be scheduled!)
          const nowIso = now.toISOString();
          try {
            await Feeding.create({
              deviceId: sched.deviceId,
              scheduledTime: sched.time,
              feedAmount: sched.amount,
              status: 'completed',
              triggerType: 'scheduled',
              enabled: false, // CRUCIAL: Must be false! This is a history log, NOT an active schedule!
            });
          } catch (e) {}

          const memList = memoryStore.feedings.get(sched.deviceId) || [];
          const historyEntry: InMemFeeding = {
            _id: 'hist_' + Date.now(),
            deviceId: sched.deviceId,
            scheduledTime: sched.time,
            feedAmount: sched.amount,
            status: 'completed',
            triggerType: 'scheduled',
            enabled: false, // CRUCIAL: Must be false!
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          memoryStore.feedings.set(sched.deviceId, [...memList, historyEntry]);
        }
      }

      // Cleanup old trigger keys once they exceed 200 items
      if (triggeredMinutes.size > 200) {
        triggeredMinutes.clear();
      }
    } catch (err: any) {
      console.warn('[Backend Feeder] Scheduler error:', err.message);
    }
  }, 5000);
}
