import client from 'prom-client';

// Collect default NodeJS metrics (memory, event loop, CPU)
client.collectDefaultMetrics({ prefix: 'ecommerce_' });

// Custom Prometheus Metrics
export const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'ecommerce_http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
});

export const httpRequestsTotal = new client.Counter({
  name: 'ecommerce_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
});

export const inventoryReservationTotal = new client.Counter({
  name: 'ecommerce_inventory_reservations_total',
  help: 'Total number of atomic inventory reservation attempts',
  labelNames: ['status', 'tenant_id'],
});

export const activeWebsocketConnections = new client.Gauge({
  name: 'ecommerce_active_websocket_connections',
  help: 'Current active WebSocket client connections',
});

export const bullQueueDepth = new client.Gauge({
  name: 'ecommerce_bullmq_queue_depth',
  help: 'Number of pending jobs in BullMQ queues',
  labelNames: ['queue_name'],
});

export const metricsRegistry = client.register;
