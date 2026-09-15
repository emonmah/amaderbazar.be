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
const index_1 = require("./index");
const logger_1 = require("../observability/logger");
const mongodb_memory_server_1 = require("mongodb-memory-server");
let mongoServer = null;
async function connectDatabase() {
    mongoose_1.default.set('strictQuery', true);
    try {
        const conn = await mongoose_1.default.connect(index_1.config.mongoUri, {
            serverSelectionTimeoutMS: 2000,
            autoIndex: true,
        });
        logger_1.logger.info(`📦 MongoDB connected to ${conn.connection.host}/${conn.connection.name}`);
        return conn;
    }
    catch (err) {
        logger_1.logger.warn('⚠️ External MongoDB not detected. Booting embedded In-Memory MongoDB Server...');
        mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        const conn = await mongoose_1.default.connect(uri, { autoIndex: true });
        logger_1.logger.info(`📦 Embedded In-Memory MongoDB connected at ${uri}`);
        // Auto-seed initial test data in memory
        try {
            const { seedData } = await Promise.resolve().then(() => __importStar(require('../seeds/seedData')));
            await seedData();
        }
        catch (seedErr) {
            logger_1.logger.warn({ seedErr }, 'Auto-seeding skipped or failed');
        }
        return conn;
    }
}
async function disconnectDatabase() {
    await mongoose_1.default.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
    logger_1.logger.info('MongoDB disconnected gracefully');
}
