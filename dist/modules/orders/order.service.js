"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderService = exports.OrderService = void 0;
const Order_1 = require("../../models/Order");
const redis_1 = require("../../config/redis");
const inventory_service_1 = require("../inventory/inventory.service");
const eventDispatcher_1 = require("../../events/eventDispatcher");
const logger_1 = require("../../observability/logger");
// State transition graph validation
const VALID_TRANSITIONS = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PACKED', 'CANCELLED'],
    PACKED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
};
class OrderService {
    /**
     * Idempotent Order Creation
     * Protects against duplicate charges/orders using Redis X-Idempotency-Key locks.
     */
    async createOrder(dto) {
        const { tenantId, idempotencyKey } = dto;
        // 1. Check Idempotency Key in Redis
        if (idempotencyKey) {
            const idempKey = `idemp:${tenantId}:${idempotencyKey}`;
            const cached = await redis_1.redis.get(idempKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.status === 'PROCESSING') {
                    throw new Error('Concurrent order submission in progress. Please wait.');
                }
                if (parsed.status === 'COMPLETED') {
                    logger_1.logger.info({ idempotencyKey }, 'Returning idempotent cached order response');
                    return { order: parsed.order, isDuplicate: true };
                }
            }
            // Mark as PROCESSING with 60s lock
            await redis_1.redis.set(idempKey, JSON.stringify({ status: 'PROCESSING' }), 'EX', 60);
        }
        try {
            // 2. Commit stock reservations
            for (const item of dto.items) {
                if (item.reservationToken) {
                    const committed = await inventory_service_1.inventoryService.commitReservation(item.reservationToken);
                    if (!committed) {
                        logger_1.logger.warn({ item }, 'Could not commit existing reservation token, proceeding with order item');
                    }
                }
            }
            // 3. Calculate total
            const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
            // 4. Create Order in MongoDB
            const order = await Order_1.OrderModel.create({
                tenantId,
                orderNumber,
                customerId: dto.customerId,
                customerEmail: dto.customerEmail,
                status: dto.paymentMethod === 'COD' ? 'CONFIRMED' : 'PENDING',
                totalAmount,
                currency: 'BDT',
                paymentMethod: dto.paymentMethod || 'COD',
                paymentStatus: 'UNPAID',
                idempotencyKey,
                shippingAddress: dto.shippingAddress,
                items: dto.items.map((i) => ({
                    variantSku: i.variantSku,
                    title: i.title,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    totalPrice: i.quantity * i.unitPrice,
                })),
            });
            // 5. Cache completed result in Redis for idempotency (24 hours TTL)
            if (idempotencyKey) {
                const idempKey = `idemp:${tenantId}:${idempotencyKey}`;
                await redis_1.redis.set(idempKey, JSON.stringify({ status: 'COMPLETED', order }), 'EX', 86400);
            }
            // 6. Dispatch domain event
            eventDispatcher_1.eventDispatcher.dispatch({
                type: 'order.placed',
                tenantId,
                payload: {
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    customerEmail: order.customerEmail,
                    totalAmount: order.totalAmount,
                    items: order.items,
                },
            });
            return { order, isDuplicate: false };
        }
        catch (error) {
            // Clear processing lock on failure
            if (idempotencyKey) {
                await redis_1.redis.del(`idemp:${tenantId}:${idempotencyKey}`);
            }
            throw error;
        }
    }
    /**
     * Order Status State Machine Transition
     * Validates transition rules and triggers domain events (e.g. Courier sync or PDF generation).
     */
    async transitionStatus(tenantId, orderId, newStatus, metadata) {
        const order = await Order_1.OrderModel.findOne({ tenantId, _id: orderId });
        if (!order) {
            throw new Error('Order not found');
        }
        const currentStatus = order.status;
        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
            throw new Error(`Invalid status transition: Cannot transition order from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ')}`);
        }
        // Apply metadata if transitioning to SHIPPED
        if (newStatus === 'SHIPPED') {
            if (metadata?.trackingNumber)
                order.trackingNumber = metadata.trackingNumber;
            if (metadata?.courierName)
                order.courierName = metadata.courierName;
        }
        order.status = newStatus;
        await order.save();
        logger_1.logger.info({ tenantId, orderId, from: currentStatus, to: newStatus }, 'Order status transitioned');
        // Dispatch state change event
        eventDispatcher_1.eventDispatcher.dispatch({
            type: 'order.status_changed',
            tenantId,
            payload: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                previousStatus: currentStatus,
                newStatus,
                trackingNumber: order.trackingNumber,
            },
        });
        return order;
    }
}
exports.OrderService = OrderService;
exports.orderService = new OrderService();
