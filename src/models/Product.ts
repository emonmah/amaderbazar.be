import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export interface IInventoryBatch {
  id?: string;
  batchNumber: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  warehouseLocation?: string;
  expiryDate?: Date;
  createdAt?: Date;
}

export interface IProductVariant {
  id?: string;
  sku: string;
  color?: string;
  size?: string;
  unitWeightKg?: number;
  price: number;
  compareAtPrice?: number;
  batches: IInventoryBatch[];
}

export interface IProduct extends Document {
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  basePrice: number;
  compareAtPrice?: number;
  discountPercent?: number;
  isHotDeal?: boolean;
  unit?: string;
  rating?: number;
  numReviews?: number;
  isPublished: boolean;
  images: string[];
  attributes: Record<string, any>;
  variants: IProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

const InventoryBatchSchema = new Schema<IInventoryBatch>(
  {
    batchNumber: { type: String, required: true },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    warehouseLocation: { type: String },
    expiryDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String, required: true },
    color: { type: String },
    size: { type: String },
    unitWeightKg: { type: Number },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number },
    batches: { type: [InventoryBatchSchema], default: [] },
  },
  { _id: true }
);

const ProductSchema = new Schema<IProduct>(
  {
    tenantId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    basePrice: { type: Number, required: true },
    compareAtPrice: { type: Number },
    discountPercent: { type: Number, default: 0 },
    isHotDeal: { type: Boolean, default: false, index: true },
    unit: { type: String, default: '1 pc' },
    rating: { type: Number, default: 5 },
    numReviews: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    images: { type: [String], default: [] },
    attributes: { type: Schema.Types.Mixed, default: {} },
    variants: { type: [ProductVariantSchema], default: [] },
  },
  { timestamps: true }
);

ProductSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, 'variants.sku': 1 });
ProductSchema.index({ tenantId: 1, category: 1, isPublished: 1 });
ProductSchema.index({ tenantId: 1, isHotDeal: 1, isPublished: 1 });
ProductSchema.plugin(tenantIsolationPlugin);

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
