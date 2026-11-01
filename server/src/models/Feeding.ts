import mongoose, { Schema, Document } from 'mongoose';

export interface IFeeding extends Document {
  deviceId: string;
  scheduledTime: string;
  feedAmount: number;
  status: string;
  triggerType?: string;
  enabled?: boolean;
  frequency?: 'once' | 'daily' | 'custom';
  customDays?: number[];
  createdAt: Date;
}

const FeedingSchema: Schema = new Schema(
  {
    deviceId: { type: String, required: true, index: true },
    scheduledTime: { type: String, required: true },
    feedAmount: { type: Number, required: true, default: 5 },
    status: { type: String, default: 'scheduled' },
    triggerType: { type: String, default: 'scheduled' },
    enabled: { type: Boolean, default: true },
    frequency: { type: String, enum: ['once', 'daily', 'custom'], default: 'daily' },
    customDays: { type: [Number], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IFeeding>('Feeding', FeedingSchema);
