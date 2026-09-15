import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface IOrderItem {
  variantSku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  zone?: string;
  postalCode: string;
  country: string;
}

export interface IOrder extends Document {
  tenantId: string;
  orderNumber: string;
  customerId?: string;
  customerEmail: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  paymentMethod?: 'BKASH' | 'SSLCOMMERZ' | 'COD' | 'STRIPE';
  paymentStatus?: 'UNPAID' | 'PAID' | 'REFUNDED';
  idempotencyKey?: string;
  shippingAddress: IShippingAddress;
  trackingNumber?: string;
  courierName?: string;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    variantSku: { type: String, required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    zone: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'US' },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    tenantId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    customerId: { type: String, index: true },
    customerEmail: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    paymentMethod: {
      type: String,
      enum: ['BKASH', 'SSLCOMMERZ', 'COD', 'STRIPE'],
      default: 'COD',
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
    },
    idempotencyKey: { type: String, sparse: true, index: true },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    trackingNumber: { type: String },
    courierName: { type: String },
    items: { type: [OrderItemSchema], default: [] },
  },
  { timestamps: true }
);

OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
OrderSchema.plugin(tenantIsolationPlugin);

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
