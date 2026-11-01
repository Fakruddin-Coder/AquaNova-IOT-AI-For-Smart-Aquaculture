import mongoose, { Schema, Document } from 'mongoose';

export interface IDevice extends Document {
  userId: mongoose.Types.ObjectId | string;
  deviceId: string;
  deviceName: string;
  status: string;
  firmwareVersion: string;
  lastSeen?: Date;
  wifiSignal?: number;
  uptimeSeconds?: number;
  createdAt: Date;
}

const DeviceSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: String, required: true, unique: true, trim: true },
    deviceName: { type: String, required: true, trim: true },
    status: { type: String, default: 'online' },
    firmwareVersion: { type: String, default: '1.2.4' },
    lastSeen: { type: Date, default: Date.now },
    wifiSignal: { type: Number, default: 85 },
    uptimeSeconds: { type: Number, default: 86400 },
  },
  { timestamps: true }
);

export default mongoose.model<IDevice>('Device', DeviceSchema);
