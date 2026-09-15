"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRegistry = exports.bullQueueDepth = exports.activeWebsocketConnections = exports.inventoryReservationTotal = exports.httpRequestsTotal = exports.httpRequestDurationMicroseconds = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
// Collect default NodeJS metrics (memory, event loop, CPU)
prom_client_1.default.collectDefaultMetrics({ prefix: 'ecommerce_' });
// Custom Prometheus Metrics
exports.httpRequestDurationMicroseconds = new prom_client_1.default.Histogram({
    name: 'ecommerce_http_request_duration_ms',
    help: 'Duration of HTTP requests in ms',
    labelNames: ['method', 'route', 'status_code', 'tenant_id'],
    buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
});
exports.httpRequestsTotal = new prom_client_1.default.Counter({
    name: 'ecommerce_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'tenant_id'],
});
exports.inventoryReservationTotal = new prom_client_1.default.Counter({
    name: 'ecommerce_inventory_reservations_total',
    help: 'Total number of atomic inventory reservation attempts',
    labelNames: ['status', 'tenant_id'],
});
exports.activeWebsocketConnections = new prom_client_1.default.Gauge({
    name: 'ecommerce_active_websocket_connections',
    help: 'Current active WebSocket client connections',
});
exports.bullQueueDepth = new prom_client_1.default.Gauge({
    name: 'ecommerce_bullmq_queue_depth',
    help: 'Number of pending jobs in BullMQ queues',
    labelNames: ['queue_name'],
});
exports.metricsRegistry = prom_client_1.default.register;
