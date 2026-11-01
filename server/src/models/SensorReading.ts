import mongoose, { Schema, Document } from 'mongoose';

export interface ISensorReading extends Document {
  deviceId: string;
  temperature: number;
  ph: number;
  waterLevel: number;
  otherSensorValues?: Record<string, any>;
  timestamp: Date;
}

const SensorReadingSchema: Schema = new Schema(
  {
    deviceId: { type: String, required: true, index: true },
    temperature: { type: Number, required: true },
    ph: { type: Number, required: true },
    waterLevel: { type: Number, required: true },
    otherSensorValues: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISensorReading>('SensorReading', SensorReadingSchema);
