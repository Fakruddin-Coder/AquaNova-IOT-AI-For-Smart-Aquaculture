import mongoose from 'mongoose';
import SensorReading from './models/SensorReading.js';
import Device from './models/Device.js';
import { seedDemoDataForDevice } from './services/seedService.js';

const DEVICE_ID = 'SIM-AQN-2026';
const USER_DEVICE_ID = 'AN-001';

function generateSimulatedData(deviceId: string, timestamp: Date, hasAnomaly: boolean) {
  const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
  // Daily cycle: peaks at 14:00 (2pm)
  const cycle = Math.sin(((hour - 8) / 24) * 2 * Math.PI); // -1 to 1

  // Base values
  let temp = 27 + cycle * 2 + (Math.random() * 0.4 - 0.2);
  let ph = 7.5 + cycle * 0.5 + (Math.random() * 0.2 - 0.1);
  let do_level = 7 - cycle * 1 + (Math.random() * 0.4 - 0.2); // DO drops when temp rises
  let turb = 5 + (cycle > 0 ? cycle * 5 : 0) + Math.random() * 2;
  let ammonia = 0.1 + (Math.random() * 0.05);
  let waterLevel = 90 + Math.random() * 2; // Fixed around 90%

  if (hasAnomaly) {
    const anomalyType = Math.floor(Math.random() * 5);
    if (anomalyType === 0) temp += 4; // Temp spike
    else if (anomalyType === 1) ph -= 1.5; // pH drop
    else if (anomalyType === 2) do_level -= 3; // DO drop
    else if (anomalyType === 3) turb += 20; // Turbidity spike
    else if (anomalyType === 4) ammonia += 0.4; // Ammonia spike
  }

  return {
    deviceId,
    temperature: Math.max(20, Math.min(35, temp)),
    ph: Math.max(5, Math.min(9, ph)),
    waterLevel: Math.max(0, Math.min(100, waterLevel)),
    otherSensorValues: {
      dissolvedOxygen: Math.max(0, Math.min(12, do_level)),
      turbidity: Math.max(0, Math.min(50, turb)),
      ammonia: Math.max(0, Math.min(1, ammonia))
    },
    timestamp
  };
}

export async function initSimulator() {
  console.log('[Simulator] Initializing data simulator...');

  // Ensure simulated device exists
  let device = await Device.findOne({ deviceId: DEVICE_ID });
  if (!device) {
    device = await Device.create({
      deviceId: DEVICE_ID,
      userId: new mongoose.Types.ObjectId(), // Fake user ID for simulation
      deviceName: 'Simulated Tank Sensor',
      status: 'active'
    });
    console.log('[Simulator] Created virtual device:', DEVICE_ID);
  }

  // Also ensure the default user device exists and has seed data in MongoDB
  let userDevice = await Device.findOne({ deviceId: USER_DEVICE_ID });
  if (!userDevice) {
    userDevice = await Device.create({
      deviceId: USER_DEVICE_ID,
      userId: new mongoose.Types.ObjectId(),
      deviceName: 'AquaNova Smart Kit',
      status: 'active'
    });
    console.log('[Simulator] Created user device:', USER_DEVICE_ID);
  }

  // Seed demo data (sensor readings, feedings, alerts, AI analysis) into MongoDB
  await seedDemoDataForDevice(USER_DEVICE_ID);
  console.log('[Simulator] Demo data seeded for device:', USER_DEVICE_ID);

  // Pre-fill 30 days of data for simulated device if empty
  const count = await SensorReading.countDocuments({ deviceId: DEVICE_ID });
  if (count === 0) {
    console.log('[Simulator] No historical data found. Generating 30 days of history...');
    const readings = [];
    const now = new Date();
    // 30 days * 24 hours * 12 (every 5 min for history to save space) = 8640 records
    for (let i = 30 * 24 * 12; i >= 0; i--) {
      const pastTime = new Date(now.getTime() - i * 5 * 60 * 1000);
      const isAnomaly = Math.random() < 0.02; // 2% anomalies
      readings.push(generateSimulatedData(DEVICE_ID, pastTime, isAnomaly));
    }
    
    // Batch insert
    const chunkSize = 1000;
    for (let i = 0; i < readings.length; i += chunkSize) {
      await SensorReading.insertMany(readings.slice(i, i + chunkSize));
    }
    console.log(`[Simulator] Inserted ${readings.length} historical records for ${DEVICE_ID}.`);
  } else {
    console.log(`[Simulator] Found ${count} existing historical records for ${DEVICE_ID}. Skipping pre-fill.`);
  }

  // Pre-fill history for user device too
  const userCount = await SensorReading.countDocuments({ deviceId: USER_DEVICE_ID });
  if (userCount < 25) {
    console.log(`[Simulator] Seeding additional history for ${USER_DEVICE_ID}...`);
    const readings = [];
    const now = new Date();
    for (let i = 7 * 24 * 12; i >= 0; i--) {
      const pastTime = new Date(now.getTime() - i * 5 * 60 * 1000);
      const isAnomaly = Math.random() < 0.02;
      readings.push(generateSimulatedData(USER_DEVICE_ID, pastTime, isAnomaly));
    }
    const chunkSize = 1000;
    for (let i = 0; i < readings.length; i += chunkSize) {
      await SensorReading.insertMany(readings.slice(i, i + chunkSize));
    }
    console.log(`[Simulator] Inserted ${readings.length} historical records for ${USER_DEVICE_ID}.`);
  }

  // Start live simulator: Every 5 seconds — pushes to all active registered devices dynamically
  console.log('[Simulator] Starting live simulation (every 5s) for all active registered devices...');
  setInterval(async () => {
    try {
      const isAnomaly = Math.random() < 0.02; // 2% chance of anomaly
      // Query active devices from MongoDB so newly bought devices get live data, and deleted devices stop receiving data
      const activeDevices = await Device.find({ status: { $ne: 'replaced' } }).select('deviceId').lean();
      const deviceIds = new Set<string>([DEVICE_ID]);
      for (const d of activeDevices) {
        if (d.deviceId) deviceIds.add(d.deviceId);
      }

      const readings = Array.from(deviceIds).map((dId) =>
        SensorReading.create(generateSimulatedData(dId, new Date(), isAnomaly))
      );
      await Promise.all(readings);
      console.log(`[Simulator] Live reading pushed to ${deviceIds.size} device(s) [${Array.from(deviceIds).join(', ')}]`);
    } catch (err) {
      console.error('[Simulator] Error inserting live reading:', err);
    }
  }, 5000);
}

