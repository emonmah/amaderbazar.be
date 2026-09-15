import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  isProduction: process.env.NODE_ENV === 'production',

  // Tenant Configuration
  tenantMode: (process.env.TENANT_MODE || 'SAAS') as 'SAAS' | 'STANDALONE',
  defaultTenantId: process.env.DEFAULT_TENANT_ID || 'tenant-fashion-001',
  rootDomain: process.env.ROOT_DOMAIN || 'platform.local',

  // Database (MongoDB)
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce_db',

  // Redis (Cache, Rate Limiting, Atomic Locks, BullMQ)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT Auth
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-super-secret-access-token-key-12345',
    accessExpiresIn: parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '900', 10), // 15 mins (900 seconds)
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-super-secret-refresh-token-key-67890',
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10), // 7 days (604800 seconds)
  },

  // Rate Limiter
  rateLimit: {
    maxPoints: parseInt(process.env.RATE_LIMIT_MAX || '10000', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  },

  // Third-Party Payment Gateways
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_mock_stripe_key',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_stripe_webhook_secret',
  },
  bkash: {
    appKey: process.env.BKASH_APP_KEY || 'mock_app_key',
    appSecret: process.env.BKASH_APP_SECRET || 'mock_app_secret',
    username: process.env.BKASH_USERNAME || 'mock_bkash_user',
    password: process.env.BKASH_PASSWORD || 'mock_bkash_password',
    baseUrl: process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
  },
  sslcommerz: {
    storeId: process.env.SSLCOMMERZ_STORE_ID || 'mock_store_id',
    storePass: process.env.SSLCOMMERZ_STORE_PASS || 'mock_store_passwd',
    isSandbox: process.env.SSLCOMMERZ_IS_SANDBOX !== 'false',
  },

  // Couriers
  steadfast: {
    apiKey: process.env.STEADFAST_API_KEY || 'mock_sf_key',
    secretKey: process.env.STEADFAST_SECRET_KEY || 'mock_sf_secret',
    baseUrl: process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1',
  },
  pathao: {
    clientId: process.env.PATHAO_CLIENT_ID || 'mock_p_client',
    clientSecret: process.env.PATHAO_CLIENT_SECRET || 'mock_p_secret',
    username: process.env.PATHAO_USERNAME || 'mock_p_user',
    password: process.env.PATHAO_PASSWORD || 'mock_p_pwd',
    baseUrl: process.env.PATHAO_BASE_URL || 'https://courier-api-sandbox.pathao.com',
  },

  // CORS
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://fashion.platform.local:3000',
    'http://techgear.platform.local:3000',
  ],
};
