"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
const index_1 = require("./index");
const logger_1 = require("../observability/logger");
let mongoServer = null;
async function connectDatabase() {
    mongoose_1.default.set('strictQuery', true);
    const isAlpine = fs_1.default.existsSync('/etc/alpine-release');
    const isProd = index_1.config.isProduction || process.env.NODE_ENV === 'production';
    const maxRetries = isProd ? 5 : 2;
    // Mask sensitive password from logs
    const maskedUri = index_1.config.mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@');
    logger_1.logger.info({ uri: maskedUri }, 'Connecting to MongoDB...');
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const conn = await mongoose_1.default.connect(index_1.config.mongoUri, {
                serverSelectionTimeoutMS: 15000,
                connectTimeoutMS: 15000,
                autoIndex: true,
            });
            logger_1.logger.info(`📦 MongoDB connected successfully to ${conn.connection.host}/${conn.connection.name}`);
            return conn;
        }
        catch (err) {
            logger_1.logger.warn({ attempt, maxRetries, error: err.message }, `⚠️ MongoDB connection attempt ${attempt}/${maxRetries} failed.`);
            if (attempt < maxRetries) {
                logger_1.logger.info('Retrying MongoDB connection in 3 seconds...');
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
            else {
                // In non-production and non-Alpine environments, attempt local MongoMemoryServer fallback
                if (!isProd && !isAlpine) {
                    try {
                        logger_1.logger.info('Attempting local development fallback: MongoMemoryServer...');
                        const { MongoMemoryServer } = await Promise.resolve().then(() => __importStar(require('mongodb-memory-server')));
                        mongoServer = await MongoMemoryServer.create();
                        const uri = mongoServer.getUri();
                        const conn = await mongoose_1.default.connect(uri, { autoIndex: true });
                        logger_1.logger.info(`📦 Embedded In-Memory MongoDB connected at ${uri}`);
                        try {
                            const { seedData } = await Promise.resolve().then(() => __importStar(require('../seeds/seedData')));
                            await seedData();
                        }
                        catch (seedErr) {
                            logger_1.logger.warn({ seedErr }, 'Auto-seeding skipped or failed');
                        }
                        return conn;
                    }
                    catch (memErr) {
                        logger_1.logger.error({ memErr: memErr.message }, 'MongoMemoryServer fallback also failed');
                    }
                }
                // Throw clear actionable error message for developers
                const helpfulError = new Error(`❌ [MongoDB Connection Error]: Could not connect to MongoDB at "${maskedUri}".\n` +
                    `Troubleshooting for Render / Production:\n` +
                    `1. Ensure the MONGODB_URI environment variable is configured in Render Settings -> Environment.\n` +
                    `2. In MongoDB Atlas: Go to "Network Access" -> ensure IP "0.0.0.0/0" is whitelisted (Render uses dynamic outbound IPs).\n` +
                    `3. In MongoDB Atlas: Verify your database username and password in the connection string.\n` +
                    `Original error: ${err.message}`);
                throw helpfulError;
            }
        }
    }
    throw new Error('Failed to connect to MongoDB after multiple attempts');
}
async function disconnectDatabase() {
    await mongoose_1.default.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
    logger_1.logger.info('MongoDB disconnected gracefully');
}
