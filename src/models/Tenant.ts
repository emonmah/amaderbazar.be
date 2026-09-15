import mongoose, { Schema, Document } from 'mongoose';

export type TenantMode = 'SAAS' | 'STANDALONE';

export interface ITenantSettings {
  currency: string;
  primaryColor?: string;
  logoUrl?: string;
  lowStockThresholdDefault: number;
  reservationHoldMinutes: number;
  paymentGateways: ('STRIPE' | 'BKASH' | 'SSLCOMMERZ' | 'COD')[];
  courierProvider?: 'STEADFAST' | 'PATHAO';
}

export interface ITenant extends Document {
  tenantId: string;
  slug: string;
  name: string;
  domain?: string;
  mode: TenantMode;
  settings: ITenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    domain: { type: String, unique: true, sparse: true, index: true },
    mode: { type: String, enum: ['SAAS', 'STANDALONE'], default: 'SAAS' },
    settings: {
      currency: { type: String, default: 'BDT' },
      primaryColor: { type: String, default: '#16A34A' },
      logoUrl: { type: String },
      lowStockThresholdDefault: { type: Number, default: 5 },
      reservationHoldMinutes: { type: Number, default: 10 },
      paymentGateways: {
        type: [String],
        enum: ['STRIPE', 'BKASH', 'SSLCOMMERZ', 'COD'],
        default: ['BKASH', 'SSLCOMMERZ', 'COD'],
      },
      courierProvider: { type: String, enum: ['STEADFAST', 'PATHAO'], default: 'STEADFAST' },
    },
  },
  { timestamps: true }
);

export const TenantModel = mongoose.model<ITenant>('Tenant', TenantSchema);
