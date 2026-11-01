import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  deviceId: string;
  type: string;
  severity: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

const AlertSchema: Schema = new Schema(
  {
    deviceId: { type: String, required: true, index: true },
    type: { type: String, required: true, default: 'sensor_warning' },
    severity: { type: String, required: true, default: 'warning' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IAlert>('Alert', AlertSchema);
