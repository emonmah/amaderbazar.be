import { EventEmitter } from 'events';
import { logger } from '../observability/logger';
import { Server as SocketIOServer } from 'socket.io';

export interface IDomainEvent<T = any> {
  type: string;
  tenantId: string;
  payload: T;
  timestamp?: Date;
  correlationId?: string;
}

class EventDispatcher extends EventEmitter {
  private io: SocketIOServer | null = null;

  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  dispatch<T>(event: IDomainEvent<T>) {
    const fullEvent: IDomainEvent<T> = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };

    logger.info({ type: fullEvent.type, tenantId: fullEvent.tenantId }, 'Domain event dispatched');
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

export const eventDispatcher = new EventDispatcher();
