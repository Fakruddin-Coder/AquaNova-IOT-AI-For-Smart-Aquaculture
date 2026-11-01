import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  order_id: string;
  status: string;
  customer_email?: string;
  assigned_device_code?: string;
  [key: string]: any;
}

const OrderSchema = new Schema<IOrder>({}, { strict: false, timestamps: false });
OrderSchema.index({ order_id: 1 }, { unique: true });

export default mongoose.model<IOrder>('Order', OrderSchema);
