import mongoose from 'mongoose';
import fs from 'fs';
import { config } from './index';
import { logger } from '../observability/logger';

let mongoServer: any = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  const isAlpine = fs.existsSync('/etc/alpine-release');
  const isProd = config.isProduction || process.env.NODE_ENV === 'production';
  const maxRetries = isProd ? 5 : 2;

  // Mask sensitive password from logs
  const maskedUri = config.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@');
  logger.info({ uri: maskedUri }, 'Connecting to MongoDB...');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        autoIndex: true,
      });
      logger.info(`📦 MongoDB connected successfully to ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err: any) {
      logger.warn(
        { attempt, maxRetries, error: err.message },
        `⚠️ MongoDB connection attempt ${attempt}/${maxRetries} failed.`
      );

      if (attempt < maxRetries) {
        logger.info('Retrying MongoDB connection in 3 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        // In non-production and non-Alpine environments, attempt local MongoMemoryServer fallback
        if (!isProd && !isAlpine) {
          try {
            logger.info('Attempting local development fallback: MongoMemoryServer...');
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            mongoServer = await MongoMemoryServer.create();
            const uri = mongoServer.getUri();
            const conn = await mongoose.connect(uri, { autoIndex: true });
            logger.info(`📦 Embedded In-Memory MongoDB connected at ${uri}`);

            try {
              const { seedData } = await import('../seeds/seedData');
              await seedData();
            } catch (seedErr) {
              logger.warn({ seedErr }, 'Auto-seeding skipped or failed');
            }

            return conn;
          } catch (memErr: any) {
            logger.error({ memErr: memErr.message }, 'MongoMemoryServer fallback also failed');
          }
        }

        // Throw clear actionable error message for developers
        const helpfulError = new Error(
          `❌ [MongoDB Connection Error]: Could not connect to MongoDB at "${maskedUri}".\n` +
          `Troubleshooting for Render / Production:\n` +
          `1. Ensure the MONGODB_URI environment variable is configured in Render Settings -> Environment.\n` +
          `2. In MongoDB Atlas: Go to "Network Access" -> ensure IP "0.0.0.0/0" is whitelisted (Render uses dynamic outbound IPs).\n` +
          `3. In MongoDB Atlas: Verify your database username and password in the connection string.\n` +
          `Original error: ${err.message}`
        );
        throw helpfulError;
      }
    }
  }

  throw new Error('Failed to connect to MongoDB after multiple attempts');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  logger.info('MongoDB disconnected gracefully');
}
