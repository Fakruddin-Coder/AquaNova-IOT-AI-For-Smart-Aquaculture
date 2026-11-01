import mongoose, { Schema, Document } from 'mongoose';

export interface IAIAnalysis extends Document {
  deviceId: string;
  healthScore: number;
  prediction: string;
  anomalies: any[];
  recommendations: any[];
  createdAt: Date;
}

const AIAnalysisSchema: Schema = new Schema(
  {
    deviceId: { type: String, required: true, index: true },
    healthScore: { type: Number, required: true, default: 95 },
    prediction: { type: String, default: 'Water parameters are optimal. No immediate actions required.' },
    anomalies: { type: Schema.Types.Mixed, default: [] },
    recommendations: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IAIAnalysis>('AIAnalysis', AIAnalysisSchema);
