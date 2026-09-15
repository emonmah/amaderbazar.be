import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export interface ICategory extends Document {
  tenantId: string;
  name: string;
  slug: string;
  icon?: string;
  imageUrl?: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    icon: { type: String, default: '🌿' },
    imageUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

CategorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ tenantId: 1, isActive: 1, displayOrder: 1 });
CategorySchema.plugin(tenantIsolationPlugin);

export const CategoryModel = mongoose.model<ICategory>('Category', CategorySchema);
