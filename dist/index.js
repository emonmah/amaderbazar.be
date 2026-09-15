"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const pino_http_1 = __importDefault(require("pino-http"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const logger_1 = require("./observability/logger");
const tracing_1 = require("./observability/tracing");
const metrics_1 = require("./observability/metrics");
// Middlewares
const tenant_middleware_1 = require("./middlewares/tenant.middleware");
const rateLimiter_middleware_1 = require("./middlewares/rateLimiter.middleware");
const eventDispatcher_1 = require("./events/eventDispatcher");
// Routes
const auth_routes_1 = require("./modules/auth/auth.routes");
const catalog_routes_1 = require("./modules/catalog/catalog.routes");
const inventory_routes_1 = require("./modules/inventory/inventory.routes");
const order_routes_1 = require("./modules/orders/order.routes");
const payment_routes_1 = require("./modules/payments/payment.routes");
const logistics_routes_1 = require("./modules/logistics/logistics.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
// Import workers to activate BullMQ processors
require("./workers");
const keepAlive_1 = require("./utils/keepAlive");
// 1. Initialize OpenTelemetry Tracing
(0, tracing_1.startTracing)();
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// 2. Setup Socket.io for Real-Time Events
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH'],
    },
});
eventDispatcher_1.eventDispatcher.setSocketIO(io);
io.on('connection', (socket) => {
    metrics_1.activeWebsocketConnections.inc();
    const tenantId = socket.handshake.query.tenantId || config_1.config.defaultTenantId;
    const room = `tenant:${tenantId}`;
    socket.join(room);
    logger_1.logger.info({ socketId: socket.id, tenantId, room }, '🔌 Client connected to WebSocket');
    socket.on('disconnect', () => {
        metrics_1.activeWebsocketConnections.dec();
        logger_1.logger.info({ socketId: socket.id }, '🔌 Client disconnected from WebSocket');
    });
});
// 3. Security & Parser Middlewares
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // In development allow all or configured
        callback(null, true);
    },
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// 4. Observability & Logging Middleware
app.use((0, pino_http_1.default)({
    logger: logger_1.logger,
    customProps: (req) => ({
        tenantId: req.tenantId,
        userId: req.user?.userId,
        ip: req.ip,
    }),
}));
// Prometheus Metric Interceptor
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const route = req.route?.path || req.path;
        const tenantId = req.tenantId || 'global';
        metrics_1.httpRequestDurationMicroseconds.observe({ method: req.method, route, status_code: res.statusCode.toString(), tenant_id: tenantId }, duration);
        metrics_1.httpRequestsTotal.inc({
            method: req.method,
            route,
            status_code: res.statusCode.toString(),
            tenant_id: tenantId,
        });
    });
    next();
});
// 5. Multi-Tenant Resolution & Global Rate Limiter
app.use(tenant_middleware_1.tenantMiddleware);
app.use(rateLimiter_middleware_1.rateLimiter);
// 6. Health & Metrics Endpoints
app.get('/health', async (req, res) => {
    const mongoStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
    let redisStatus = 'disconnected';
    try {
        const ping = await redis_1.redis.ping();
        if (ping === 'PONG')
            redisStatus = 'connected';
    }
    catch (e) {
        redisStatus = 'error';
    }
    const isHealthy = mongoStatus === 'connected' && redisStatus === 'connected';
    const uptimeSec = Math.floor(process.uptime());
    const uptimeMin = Math.floor(uptimeSec / 60);
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        uptimeSeconds: uptimeSec,
        uptimeFormatted: `${uptimeMin}m ${uptimeSec % 60}s`,
        antiSleepKeepAlive: (0, keepAlive_1.getKeepAliveStatus)(),
        timestamp: new Date(),
        tenantMode: config_1.config.tenantMode,
        services: {
            mongodb: mongoStatus,
            redis: redisStatus,
            socketIO: 'active',
            bullMQ: 'active',
        },
    });
});
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics_1.metricsRegistry.contentType);
    res.end(await metrics_1.metricsRegistry.metrics());
});
// 7. Mount REST API Routes
app.use('/api/v1/auth', auth_routes_1.authRoutes);
app.use('/api/v1/catalog', catalog_routes_1.catalogRoutes);
app.use('/api/v1/inventory', inventory_routes_1.inventoryRoutes);
app.use('/api/v1/orders', order_routes_1.orderRoutes);
app.use('/api/v1/payments', payment_routes_1.paymentRoutes);
app.use('/api/v1/logistics', logistics_routes_1.logisticsRoutes);
app.use('/api/v1/admin', admin_routes_1.adminRoutes);
// Root Welcome Endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Enterprise Multi-Tenant E-Commerce REST API',
        tenantId: req.tenantId,
        mode: config_1.config.tenantMode,
        version: '1.0.0',
        documentation: '/api/v1',
    });
});
// 8. Central Error Handler
app.use((err, req, res, next) => {
    logger_1.logger.error({ err, path: req.path }, 'Unhandled error in request pipeline');
    res.status(err.status || 500).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'An unexpected error occurred',
    });
});
// 9. Server Initialization
async function startServer() {
    try {
        await (0, database_1.connectDatabase)();
        await (0, redis_1.connectRedis)();
        server.listen(config_1.config.port, () => {
            logger_1.logger.info(`🚀 Server running on port ${config_1.config.port} in ${config_1.config.env} mode`);
            logger_1.logger.info(`📊 Prometheus metrics available at http://localhost:${config_1.config.port}/metrics`);
            logger_1.logger.info(`💓 Health probe available at http://localhost:${config_1.config.port}/health`);
            // Start 10-minute anti-sleep heartbeat to prevent Render free tier from pausing backend
            (0, keepAlive_1.startKeepAliveSelfPing)();
        });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to start server');
        process.exit(1);
    }
}
// Graceful Shutdown
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received: closing HTTP server and connections');
    server.close(async () => {
        await mongoose_1.default.disconnect();
        await redis_1.redis.quit();
        process.exit(0);
    });
});
startServer();
