import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export interface ISlider extends Document {
  tenantId: string;
  title: string;
  subtitle?: string;
  badge?: string;
  imageUrl: string;
  linkUrl: string;
  buttonText: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SliderSchema = new Schema<ISlider>(
  {
    tenantId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    badge: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String, default: '/' },
    buttonText: { type: String, default: 'Shop Now' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

SliderSchema.index({ tenantId: 1, isActive: 1, displayOrder: 1 });
SliderSchema.plugin(tenantIsolationPlugin);

export const SliderModel = mongoose.model<ISlider>('Slider', SliderSchema);
