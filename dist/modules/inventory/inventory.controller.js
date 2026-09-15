"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryController = exports.InventoryController = void 0;
const inventory_service_1 = require("./inventory.service");
const Product_1 = require("../../models/Product");
const redis_1 = require("../../config/redis");
class InventoryController {
    async reserve(req, res) {
        try {
            const tenantId = req.tenantId;
            const { variantSku, quantity, holdMinutes = 10 } = req.body;
            if (!variantSku || !quantity || quantity <= 0) {
                return res.status(400).json({ error: 'variantSku and positive quantity are required' });
            }
            const result = await inventory_service_1.inventoryService.reserveStock(tenantId, variantSku, quantity, holdMinutes);
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
        }
        catch (error) {
            res.status(500).json({ error: 'Internal server error during reservation' });
        }
    }
    async release(req, res) {
        try {
            const { reservationToken } = req.body;
            if (!reservationToken) {
                return res.status(400).json({ error: 'reservationToken is required' });
            }
            const released = await inventory_service_1.inventoryService.releaseReservation(reservationToken);
            res.json({ success: released });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to release reservation' });
        }
    }
    async getStock(req, res) {
        try {
            const tenantId = req.tenantId;
            const { variantSku } = req.params;
            const product = await Product_1.ProductModel.findOne({ tenantId, 'variants.sku': variantSku });
            if (!product)
                return res.status(404).json({ error: 'Variant not found' });
            const variant = product.variants.find((v) => v.sku === variantSku);
            const totalPhysical = variant?.batches.reduce((sum, b) => sum + b.quantity, 0) || 0;
            const reservedKey = `stock_reserved:${tenantId}:${variantSku}`;
            const currentReserved = parseInt((await redis_1.redis.get(reservedKey)) || '0', 10);
            res.json({
                variantSku,
                totalPhysicalStock: totalPhysical,
                currentReservedStock: currentReserved,
                availableStock: Math.max(0, totalPhysical - currentReserved),
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to check stock' });
        }
    }
}
exports.InventoryController = InventoryController;
exports.inventoryController = new InventoryController();
