/**
 * Production-safe admin credential seeder.
 * - Does NOT wipe any existing data.
 * - Creates the tenant if missing.
 * - Creates the SUPER_ADMIN user if no admin exists.
 * - Skips silently if admin already exists.
 *
 * Usage:
 *   npx tsx src/seeds/seedAdmin.ts
 *   (or via npm script: npm run seed:admin)
 *
 * Required env vars:
 *   MONGODB_URI        — MongoDB Atlas connection string
 *   ADMIN_EMAIL        — admin email     (default: admin@amaderbazar.com)
 *   ADMIN_PASSWORD     — admin password  (default: Password123!)
 *   ADMIN_NAME         — admin full name (default: Amader Bazar Super Admin)
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { TenantModel } from '../models/Tenant';
import { UserModel } from '../models/User';

const TENANT_ID = 'tenant-fashion-001';
const TENANT_SLUG = 'amaderbazar';

async function seedAdmin() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@amaderbazar.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Password123!';
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Amader Bazar Super Admin';

  console.log('🔐 Starting Admin Credential Seeder (production-safe)...');
  console.log(`   MongoDB URI: ${config.mongoUri.replace(/\/\/.*@/, '//*****@')}`);
  console.log(`   Admin email: ${ADMIN_EMAIL}`);

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log('✅ Connected to MongoDB');

  // 1. Ensure tenant exists
  let tenant = await TenantModel.findOne({ tenantId: TENANT_ID });
  if (!tenant) {
    tenant = await TenantModel.create({
      tenantId: TENANT_ID,
      slug: TENANT_SLUG,
      name: 'আমাদের বাজার (Amader Bazar) - Pure & Organic',
      domain: 'amaderbazar.com',
      mode: 'STANDALONE',
      settings: {
        currency: 'BDT',
        primaryColor: '#16A34A',
        lowStockThresholdDefault: 5,
        reservationHoldMinutes: 10,
        paymentGateways: ['BKASH', 'SSLCOMMERZ', 'COD'],
        courierProvider: 'STEADFAST',
      },
    });
    console.log(`✅ Tenant created: ${tenant.name}`);
  } else {
    console.log(`ℹ️  Tenant already exists: ${tenant.name}`);
  }

  // 2. Check if admin already exists — skip if present
  const existingAdmin = await UserModel.findOne({
    tenantId: TENANT_ID,
    role: 'SUPER_ADMIN',
  });

  if (existingAdmin) {
    console.log(`ℹ️  Admin already exists: ${existingAdmin.email} — skipping creation.`);
    await mongoose.disconnect();
    console.log('✨ Done (no changes made).');
    return;
  }

  // 3. Create admin user
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await UserModel.create({
    tenantId: TENANT_ID,
    email: ADMIN_EMAIL,
    passwordHash,
    name: ADMIN_NAME,
    role: 'SUPER_ADMIN',
  });

  console.log(`✅ Admin created successfully!`);
  console.log(`   Email   : ${admin.email}`);
  console.log(`   Role    : ${admin.role}`);
  console.log(`   TenantId: ${admin.tenantId}`);
  console.log('');
  console.log('⚠️  IMPORTANT: Change the admin password after first login!');

  await mongoose.disconnect();
  console.log('✨ Admin seeding completed!');
}

seedAdmin().catch((err) => {
  console.error('❌ Admin seeding failed:', err.message || err);
  process.exit(1);
});
