import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aquanova';
console.log('Connecting to MongoDB:', mongoUri);

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const Feeding = mongoose.model('Feeding', new mongoose.Schema({}, { strict: false }));
    
    // Set enabled: false on all completed or manual entries
    const res1 = await Feeding.updateMany(
      { $or: [{ status: 'completed' }, { triggerType: 'manual' }] },
      { $set: { enabled: false } }
    );
    console.log(`Updated ${res1.modifiedCount} completed/manual feeding records to enabled: false.`);

    // If there are duplicate schedules for the same scheduledTime, keep only one enabled
    const active = await Feeding.find({ status: 'scheduled', enabled: true });
    console.log(`Active schedules found: ${active.length}`);
    const seenTimes = new Set();
    let disabledDupes = 0;
    for (const s of active) {
      const key = `${s.deviceId}_${s.scheduledTime}`;
      if (seenTimes.has(key)) {
        await Feeding.updateOne({ _id: s._id }, { $set: { enabled: false } });
        disabledDupes++;
      } else {
        seenTimes.add(key);
      }
    }
    if (disabledDupes > 0) {
      console.log(`Disabled ${disabledDupes} duplicate active schedules.`);
    }

    console.log('✅ Feeder database sanitization complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Database cleanup error:', err.message);
    process.exit(0); // non-fatal if mongo is offline
  }
}

run();
