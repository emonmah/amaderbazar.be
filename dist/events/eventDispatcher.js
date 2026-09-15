"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventDispatcher = void 0;
const events_1 = require("events");
const logger_1 = require("../observability/logger");
class EventDispatcher extends events_1.EventEmitter {
    io = null;
    setSocketIO(io) {
        this.io = io;
    }
    dispatch(event) {
        const fullEvent = {
            ...event,
            timestamp: event.timestamp || new Date(),
        };
        logger_1.logger.info({ type: fullEvent.type, tenantId: fullEvent.tenantId }, 'Domain event dispatched');
        this.emit(fullEvent.type, fullEvent);
        this.emit('*', fullEvent);
        // Broadcast to tenant-specific WebSocket room
        if (this.io) {
            this.io.to(`tenant:${fullEvent.tenantId}`).emit('domain_event', fullEvent);
            if (fullEvent.type === 'inventory.low_stock_alert') {
                this.io.to(`tenant:${fullEvent.tenantId}`).emit('low_stock_alert', fullEvent.payload);
            }
            if (fullEvent.type === 'order.status_changed') {
                this.io.to(`tenant:${fullEvent.tenantId}`).emit('order_status_updated', fullEvent.payload);
            }
        }
    }
}
exports.eventDispatcher = new EventDispatcher();
