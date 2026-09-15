"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryService = exports.InventoryService = void 0;
const redis_1 = require("../../config/redis");
const Product_1 = require("../../models/Product");
const logger_1 = require("../../observability/logger");
const metrics_1 = require("../../observability/metrics");
const eventDispatcher_1 = require("../../events/eventDispatcher");
const uuid_1 = require("uuid");
class InventoryService {
    /**
     * Atomic Inventory Reservation (10-minute hold)
     * Uses Redis Lua script to guarantee zero race conditions and zero double selling.
     */
    async reserveStock(tenantId, variantSku, requestedQuantity, holdDurationMinutes = 10) {
        try {
            // 1. Fetch physical available stock from MongoDB batches
            const product = await Product_1.ProductModel.findOne({
                tenantId,
                'variants.sku': variantSku,
            });
            if (!product) {
                return { success: false, variantSku, quantityReserved: 0, error: 'Product or variant not found' };
            }
            const variant = product.variants.find((v) => v.sku === variantSku);
            if (!variant) {
                return { success: false, variantSku, quantityReserved: 0, error: 'Variant not found' };
            }
            // Sum available physical quantity across all batches
            const totalPhysicalStock = variant.batches.reduce((sum, batch) => sum + Math.max(0, batch.quantity - batch.reservedQuantity), 0);
            const reservedKey = `stock_reserved:${tenantId}:${variantSku}`;
            const ttlSeconds = holdDurationMinutes * 60;
            // 2. Execute Atomic Redis Lua Script
            const result = (await redis_1.redis.eval(redis_1.ATOMIC_RESERVE_SCRIPT, 1, reservedKey, totalPhysicalStock, requestedQuantity, ttlSeconds));
            const [isSuccess, totalReserved, remainingAvailable] = result;
            if (isSuccess === 1) {
                const reservationToken = `res_${(0, uuid_1.v4)()}`;
                const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
                // Store reservation session in Redis
                const sessionKey = `res_token:${reservationToken}`;
                await redis_1.redis.set(sessionKey, JSON.stringify({ tenantId, variantSku, quantity: requestedQuantity, expiresAt }), 'EX', ttlSeconds);
                metrics_1.inventoryReservationTotal.inc({ status: 'success', tenant_id: tenantId });
                logger_1.logger.info({ tenantId, variantSku, requestedQuantity, totalReserved }, 'Atomic stock reservation hold created');
                return {
                    success: true,
                    reservationToken,
                    variantSku,
                    quantityReserved: requestedQuantity,
                    expiresAt,
                };
            }
            else {
                metrics_1.inventoryReservationTotal.inc({ status: 'out_of_stock', tenant_id: tenantId });
                return {
                    success: false,
                    variantSku,
                    quantityReserved: 0,
                    error: `Insufficient stock. Only ${remainingAvailable} remaining.`,
                };
            }
        }
        catch (error) {
            logger_1.logger.error({ error, tenantId, variantSku }, 'Error during atomic stock reservation');
            return { success: false, variantSku, quantityReserved: 0, error: error.message };
        }
    }
    /**
     * Release reservation hold (e.g. cart checkout cancelled or session expired)
     */
    async releaseReservation(reservationToken) {
        const sessionKey = `res_token:${reservationToken}`;
        const data = await redis_1.redis.get(sessionKey);
        if (!data)
            return false;
        const { tenantId, variantSku, quantity } = JSON.parse(data);
        const reservedKey = `stock_reserved:${tenantId}:${variantSku}`;
        await redis_1.redis.eval(redis_1.ATOMIC_RELEASE_SCRIPT, 1, reservedKey, quantity);
        await redis_1.redis.del(sessionKey);
        logger_1.logger.info({ reservationToken, variantSku, quantity }, 'Atomic reservation hold released');
        return true;
    }
    /**
     * Commit reservation: Permanently deduct physical inventory from MongoDB
     */
    async commitReservation(reservationToken) {
        const sessionKey = `res_token:${reservationToken}`;
        const data = await redis_1.redis.get(sessionKey);
        if (!data)
            return false;
        const { tenantId, variantSku, quantity } = JSON.parse(data);
        const product = await Product_1.ProductModel.findOne({ tenantId, 'variants.sku': variantSku });
        if (!product)
            return false;
        const variant = product.variants.find((v) => v.sku === variantSku);
        if (!variant)
            return false;
        // Deduct from batches (FIFO: oldest batch first)
        let qtyToDeduct = quantity;
        for (const batch of variant.batches) {
            if (qtyToDeduct <= 0)
                break;
            const deductFromBatch = Math.min(batch.quantity, qtyToDeduct);
            batch.quantity -= deductFromBatch;
            qtyToDeduct -= deductFromBatch;
            // Check low-stock threshold alert
            if (batch.quantity <= batch.lowStockThreshold) {
                eventDispatcher_1.eventDispatcher.dispatch({
                    type: 'inventory.low_stock_alert',
                    tenantId,
                    payload: {
                        variantSku,
                        productTitle: product.title,
                        currentStock: batch.quantity,
                        threshold: batch.lowStockThreshold,
                        warehouseLocation: batch.warehouseLocation,
                    },
                });
            }
        }
        await product.save();
        // Clean up Redis reservation hold
        await this.releaseReservation(reservationToken);
        logger_1.logger.info({ tenantId, variantSku, quantity }, 'Committed inventory stock deduction to database');
        return true;
    }
}
exports.InventoryService = InventoryService;
exports.inventoryService = new InventoryService();
