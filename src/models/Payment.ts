import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentGatewayType = 'STRIPE' | 'BKASH' | 'SSLCOMMERZ';

export interface IPayment extends Document {
  tenantId: string;
  orderId: string;
  gateway: PaymentGatewayType;
  transactionId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  rawResponse?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    gateway: {
      type: String,
      enum: ['STRIPE', 'BKASH', 'SSLCOMMERZ'],
      required: true,
    },
    transactionId: { type: String, sparse: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    rawResponse: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

PaymentSchema.index({ tenantId: 1, transactionId: 1 });
PaymentSchema.plugin(tenantIsolationPlugin);

export const PaymentModel = mongoose.model<IPayment>('Payment', PaymentSchema);
