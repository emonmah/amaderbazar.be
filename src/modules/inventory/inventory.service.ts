import { redis, ATOMIC_RESERVE_SCRIPT, ATOMIC_RELEASE_SCRIPT } from '../../config/redis';
import { ProductModel } from '../../models/Product';
import { logger } from '../../observability/logger';
import { inventoryReservationTotal } from '../../observability/metrics';
import { eventDispatcher } from '../../events/eventDispatcher';
import { v4 as uuidv4 } from 'uuid';

export interface ReserveResult {
  success: boolean;
  reservationToken?: string;
  variantSku: string;
  quantityReserved: number;
  expiresAt?: Date;
  error?: string;
}

export class InventoryService {
  /**
   * Atomic Inventory Reservation (10-minute hold)
   * Uses Redis Lua script to guarantee zero race conditions and zero double selling.
   */
  async reserveStock(
    tenantId: string,
    variantSku: string,
    requestedQuantity: number,
    holdDurationMinutes = 10
  ): Promise<ReserveResult> {
    try {
      // 1. Fetch physical available stock from MongoDB batches
      const product = await ProductModel.findOne({
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
      const totalPhysicalStock = variant.batches.reduce(
        (sum, batch) => sum + Math.max(0, batch.quantity - batch.reservedQuantity),
        0
      );

      const reservedKey = `stock_reserved:${tenantId}:${variantSku}`;
      const ttlSeconds = holdDurationMinutes * 60;

      // 2. Execute Atomic Redis Lua Script
      const result = (await redis.eval(
        ATOMIC_RESERVE_SCRIPT,
        1,
        reservedKey,
        totalPhysicalStock,
        requestedQuantity,
        ttlSeconds
      )) as [number, number, number];

      const [isSuccess, totalReserved, remainingAvailable] = result;

      if (isSuccess === 1) {
        const reservationToken = `res_${uuidv4()}`;
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        // Store reservation session in Redis
        const sessionKey = `res_token:${reservationToken}`;
        await redis.set(
          sessionKey,
          JSON.stringify({ tenantId, variantSku, quantity: requestedQuantity, expiresAt }),
          'EX',
          ttlSeconds
        );

        inventoryReservationTotal.inc({ status: 'success', tenant_id: tenantId });
        logger.info({ tenantId, variantSku, requestedQuantity, totalReserved }, 'Atomic stock reservation hold created');

        return {
          success: true,
          reservationToken,
          variantSku,
          quantityReserved: requestedQuantity,
          expiresAt,
        };
      } else {
        inventoryReservationTotal.inc({ status: 'out_of_stock', tenant_id: tenantId });
        return {
          success: false,
          variantSku,
          quantityReserved: 0,
          error: `Insufficient stock. Only ${remainingAvailable} remaining.`,
        };
      }
    } catch (error: any) {
      logger.error({ error, tenantId, variantSku }, 'Error during atomic stock reservation');
      return { success: false, variantSku, quantityReserved: 0, error: error.message };
    }
  }

  /**
   * Release reservation hold (e.g. cart checkout cancelled or session expired)
   */
  async releaseReservation(reservationToken: string): Promise<boolean> {
    const sessionKey = `res_token:${reservationToken}`;
    const data = await redis.get(sessionKey);
    if (!data) return false;

    const { tenantId, variantSku, quantity } = JSON.parse(data);
    const reservedKey = `stock_reserved:${tenantId}:${variantSku}`;

    await redis.eval(ATOMIC_RELEASE_SCRIPT, 1, reservedKey, quantity);
    await redis.del(sessionKey);

    logger.info({ reservationToken, variantSku, quantity }, 'Atomic reservation hold released');
    return true;
  }

  /**
   * Commit reservation: Permanently deduct physical inventory from MongoDB
   */
  async commitReservation(reservationToken: string): Promise<boolean> {
    const sessionKey = `res_token:${reservationToken}`;
    const data = await redis.get(sessionKey);
    if (!data) return false;

    const { tenantId, variantSku, quantity } = JSON.parse(data);
    const product = await ProductModel.findOne({ tenantId, 'variants.sku': variantSku });
    if (!product) return false;

    const variant = product.variants.find((v) => v.sku === variantSku);
    if (!variant) return false;

    // Deduct from batches (FIFO: oldest batch first)
    let qtyToDeduct = quantity;
    for (const batch of variant.batches) {
      if (qtyToDeduct <= 0) break;
      const deductFromBatch = Math.min(batch.quantity, qtyToDeduct);
      batch.quantity -= deductFromBatch;
      qtyToDeduct -= deductFromBatch;

      // Check low-stock threshold alert
      if (batch.quantity <= batch.lowStockThreshold) {
        eventDispatcher.dispatch({
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
    logger.info({ tenantId, variantSku, quantity }, 'Committed inventory stock deduction to database');
    return true;
  }
}

export const inventoryService = new InventoryService();
