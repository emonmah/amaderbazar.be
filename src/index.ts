import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';

import { config } from './config';
import { connectDatabase } from './config/database';
import { connectRedis, redis } from './config/redis';
import { logger } from './observability/logger';
import { startTracing } from './observability/tracing';
import {
  metricsRegistry,
  httpRequestDurationMicroseconds,
  httpRequestsTotal,
  activeWebsocketConnections,
} from './observability/metrics';

// Middlewares
import { tenantMiddleware } from './middlewares/tenant.middleware';
import { rateLimiter } from './middlewares/rateLimiter.middleware';
import { eventDispatcher } from './events/eventDispatcher';

// Routes
import { authRoutes } from './modules/auth/auth.routes';
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { inventoryRoutes } from './modules/inventory/inventory.routes';
import { orderRoutes } from './modules/orders/order.routes';
import { paymentRoutes } from './modules/payments/payment.routes';
import { logisticsRoutes } from './modules/logistics/logistics.routes';
import { adminRoutes } from './modules/admin/admin.routes';

// Import workers to activate BullMQ processors
import './workers';
import { startKeepAliveSelfPing, getKeepAliveStatus } from './utils/keepAlive';

// 1. Initialize OpenTelemetry Tracing
startTracing();

const app = express();
const server = http.createServer(app);

// 2. Setup Socket.io for Real-Time Events
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH'],
  },
});

eventDispatcher.setSocketIO(io);

io.on('connection', (socket) => {
  activeWebsocketConnections.inc();
  const tenantId = (socket.handshake.query.tenantId as string) || config.defaultTenantId;
  const room = `tenant:${tenantId}`;
  socket.join(room);

  logger.info({ socketId: socket.id, tenantId, room }, '🔌 Client connected to WebSocket');

  socket.on('disconnect', () => {
    activeWebsocketConnections.dec();
    logger.info({ socketId: socket.id }, '🔌 Client disconnected from WebSocket');
  });
});

// 3. Security & Parser Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      // In development allow all or configured
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Observability & Logging Middleware
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      tenantId: (req as any).tenantId,
      userId: (req as any).user?.userId,
      ip: req.ip,
    }),
  })
);

// Prometheus Metric Interceptor
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;
    const tenantId = req.tenantId || 'global';
    httpRequestDurationMicroseconds.observe(
      { method: req.method, route, status_code: res.statusCode.toString(), tenant_id: tenantId },
      duration
    );
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
      tenant_id: tenantId,
    });
  });
  next();
});

// 5. Multi-Tenant Resolution & Global Rate Limiter
app.use(tenantMiddleware);
app.use(rateLimiter);

// 6. Health & Metrics Endpoints
app.get('/health', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  let redisStatus = 'disconnected';
  try {
    const ping = await redis.ping();
    if (ping === 'PONG') redisStatus = 'connected';
  } catch (e) {
    redisStatus = 'error';
  }

  const isHealthy = mongoStatus === 'connected' && redisStatus === 'connected';
  const uptimeSec = Math.floor(process.uptime());
  const uptimeMin = Math.floor(uptimeSec / 60);

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    uptimeSeconds: uptimeSec,
    uptimeFormatted: `${uptimeMin}m ${uptimeSec % 60}s`,
    antiSleepKeepAlive: getKeepAliveStatus(),
    timestamp: new Date(),
    tenantMode: config.tenantMode,
    services: {
      mongodb: mongoStatus,
      redis: redisStatus,
      socketIO: 'active',
      bullMQ: 'active',
    },
  });
});

app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

// 7. Mount REST API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/logistics', logisticsRoutes);
app.use('/api/v1/admin', adminRoutes);

// Root Welcome Endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Enterprise Multi-Tenant E-Commerce REST API',
    tenantId: req.tenantId,
    mode: config.tenantMode,
    version: '1.0.0',
    documentation: '/api/v1',
  });
});

// 8. Central Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path }, 'Unhandled error in request pipeline');
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
  });
});

// 9. Server Initialization
async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();

    server.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port} in ${config.env} mode`);
      logger.info(`📊 Prometheus metrics available at http://localhost:${config.port}/metrics`);
      logger.info(`💓 Health probe available at http://localhost:${config.port}/health`);

      // Start 10-minute anti-sleep heartbeat to prevent Render free tier from pausing backend
      startKeepAliveSelfPing();
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received: closing HTTP server and connections');
  server.close(async () => {
    await mongoose.disconnect();
    await redis.quit();
    process.exit(0);
  });
});

startServer();

export { app, server };
