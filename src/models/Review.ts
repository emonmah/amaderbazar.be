import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export interface IReview extends Document {
  tenantId: string;
  productId: Schema.Types.ObjectId;
  userId?: string;
  userName: string;
  userEmail: string;
  rating: number; // 1 to 5
  comment: string;
  verifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    tenantId: { type: String, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: String, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    verifiedPurchase: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ReviewSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
ReviewSchema.plugin(tenantIsolationPlugin);

export const ReviewModel = mongoose.model<IReview>('Review', ReviewSchema);
