import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../observability/logger';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 2000,
      autoIndex: true,
    });
    logger.info(`📦 MongoDB connected to ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    logger.warn('⚠️ External MongoDB not detected. Booting embedded In-Memory MongoDB Server...');
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    const conn = await mongoose.connect(uri, { autoIndex: true });
    logger.info(`📦 Embedded In-Memory MongoDB connected at ${uri}`);

    // Auto-seed initial test data in memory
    try {
      const { seedData } = await import('../seeds/seedData');
      await seedData();
    } catch (seedErr) {
      logger.warn({ seedErr }, 'Auto-seeding skipped or failed');
    }

    return conn;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  logger.info('MongoDB disconnected gracefully');
}
