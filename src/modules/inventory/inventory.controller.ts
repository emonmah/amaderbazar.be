import { Request, Response } from 'express';
import { inventoryService } from './inventory.service';
import { ProductModel } from '../../models/Product';
import { redis } from '../../config/redis';

export class InventoryController {
  async reserve(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { variantSku, quantity, holdMinutes = 10 } = req.body;

      if (!variantSku || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'variantSku and positive quantity are required' });
      }

      const result = await inventoryService.reserveStock(tenantId, variantSku, quantity, holdMinutes);

      if (!result.success) {
        return res.status(409).json({
          error: 'ReservationFailed',
          message: result.error || 'Insufficient stock to satisfy reservation hold',
        });
      }

      res.status(200).json({
        message: 'Stock successfully reserved (hold active)',
        reservationToken: result.reservationToken,
        variantSku: result.variantSku,
        quantityReserved: result.quantityReserved,
        expiresAt: result.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error during reservation' });
    }
  }

  async release(req: Request, res: Response) {
    try {
      const { reservationToken } = req.body;
      if (!reservationToken) {
        return res.status(400).json({ error: 'reservationToken is required' });
      }

      const released = await inventoryService.releaseReservation(reservationToken);
      res.json({ success: released });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to release reservation' });
    }
  }

  async getStock(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { variantSku } = req.params;

      const product = await ProductModel.findOne({ tenantId, 'variants.sku': variantSku });
      if (!product) return res.status(404).json({ error: 'Variant not found' });

      const variant = product.variants.find((v) => v.sku === variantSku);
      const totalPhysical = variant?.batches.reduce((sum, b) => sum + b.quantity, 0) || 0;

      const reservedKey = `stock_reserved:${tenantId}:${variantSku}`;
      const currentReserved = parseInt((await redis.get(reservedKey)) || '0', 10);

      res.json({
        variantSku,
        totalPhysicalStock: totalPhysical,
        currentReservedStock: currentReserved,
        availableStock: Math.max(0, totalPhysical - currentReserved),
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to check stock' });
    }
  }
}

export const inventoryController = new InventoryController();
