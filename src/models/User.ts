import mongoose, { Schema, Document } from 'mongoose';
import { tenantIsolationPlugin } from '../plugins/tenantIsolation.plugin';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'STORE_OWNER'
  | 'WAREHOUSE_MANAGER'
  | 'SUPPORT_REP'
  | 'CUSTOMER';

export interface IRefreshToken {
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByToken?: string;
  createdAt: Date;
}

export interface IUser extends Document {
  tenantId: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  permissions: string[];
  refreshTokens: IRefreshToken[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>({
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  replacedByToken: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'STORE_OWNER', 'WAREHOUSE_MANAGER', 'SUPPORT_REP', 'CUSTOMER'],
      default: 'CUSTOMER',
      index: true,
    },
    permissions: { type: [String], default: [] },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound Unique index: email per tenant
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.plugin(tenantIsolationPlugin);

export const UserModel = mongoose.model<IUser>('User', UserSchema);
