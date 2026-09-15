import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export type CourierProvider = 'STEADFAST' | 'PATHAO';

export interface IShipment extends Document {
  tenantId: string;
  orderId: string;
  courier: CourierProvider;
  consignmentId: string;
  trackingCode?: string;
  status: string;
  labelUrl?: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentSchema = new Schema<IShipment>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    courier: {
      type: String,
      enum: ['STEADFAST', 'PATHAO'],
      required: true,
    },
    consignmentId: { type: String, required: true, unique: true, index: true },
    trackingCode: { type: String, sparse: true, index: true },
    status: { type: String, default: 'PLACED', index: true },
    labelUrl: { type: String },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
  },
  { timestamps: true }
);

ShipmentSchema.index({ tenantId: 1, orderId: 1 });
ShipmentSchema.plugin(tenantIsolationPlugin);

export const ShipmentModel = mongoose.model<IShipment>('Shipment', ShipmentSchema);
