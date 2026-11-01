import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationPreferences {
  emailAlerts: boolean;
  criticalOnly: boolean;
  dailySummary: boolean;
  feedingReminders: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role?: 'customer' | 'admin';
  /** False only for newly registered accounts until their kit order is verified. */
  kitPurchased?: boolean;
  phone?: string;
  address?: string;
  avatarUrl?: string | null;
  tankDetails?: Record<string, any> | string;
  isVerified: boolean;
  otpHash?: string | null;
  otpExpiresAt?: Date | null;
  otpAttempts?: number;
  otpLastSentAt?: Date | null;
  notificationPreferences?: INotificationPreferences;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  pendingNewEmail?: string | null;
  createdAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    kitPurchased: { type: Boolean },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    avatarUrl: { type: String, default: null },
    tankDetails: { type: Schema.Types.Mixed, default: {} },
    isVerified: { type: Boolean, default: false },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    otpLastSentAt: { type: Date, default: null },
    notificationPreferences: {
      emailAlerts: { type: Boolean, default: true },
      criticalOnly: { type: Boolean, default: false },
      dailySummary: { type: Boolean, default: true },
      feedingReminders: { type: Boolean, default: true },
    },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    pendingNewEmail: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
