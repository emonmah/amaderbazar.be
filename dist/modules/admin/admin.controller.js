"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const Order_1 = require("../../models/Order");
const Product_1 = require("../../models/Product");
const workers_1 = require("../../workers");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class AdminController {
    /**
     * Kanban Board Data Provider
     * Organizes orders into status buckets for the admin Kanban board
     */
    async getKanbanOrders(req, res) {
        try {
            const tenantId = req.tenantId;
            const orders = await Order_1.OrderModel.find({ tenantId }).sort({ updatedAt: -1 }).lean();
            const kanban = {
                PENDING: orders.filter((o) => o.status === 'PENDING'),
                CONFIRMED: orders.filter((o) => o.status === 'CONFIRMED'),
                PACKED: orders.filter((o) => o.status === 'PACKED'),
                SHIPPED: orders.filter((o) => o.status === 'SHIPPED'),
                DELIVERED: orders.filter((o) => o.status === 'DELIVERED'),
            };
            res.json({ kanban, totalOrders: orders.length });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch kanban orders' });
        }
    }
    /**
     * SKU Variant Matrix & Warehouse Batches
     */
    async getInventoryMatrix(req, res) {
        try {
            const tenantId = req.tenantId;
            const products = await Product_1.ProductModel.find({ tenantId }).lean();
            const matrix = products.flatMap((product) => product.variants.map((variant) => {
                const totalStock = variant.batches.reduce((sum, b) => sum + b.quantity, 0);
                const threshold = variant.batches[0]?.lowStockThreshold || 10;
                const warehouseLocation = variant.batches[0]?.warehouseLocation || 'MAIN_STORAGE';
                return {
                    productId: product._id,
                    productTitle: product.title,
                    category: product.category,
                    sku: variant.sku,
                    color: variant.color,
                    size: variant.size,
                    unitWeightKg: variant.unitWeightKg,
                    price: variant.price,
                    totalStock,
                    threshold,
                    warehouseLocation,
                    isLowStock: totalStock <= threshold,
                    batches: variant.batches,
                };
            }));
            res.json({ matrix, totalSkus: matrix.length });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch inventory matrix' });
        }
    }
    /**
     * Trigger Asynchronous PDF Invoice Generation
     */
    async triggerInvoiceGeneration(req, res) {
        try {
            const tenantId = req.tenantId;
            const { id } = req.params;
            const order = await Order_1.OrderModel.findOne({ tenantId, _id: id });
            if (!order)
                return res.status(404).json({ error: 'Order not found' });
            const job = await workers_1.invoiceQueue.add('generate-pdf-manual', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                customerEmail: order.customerEmail,
                totalAmount: order.totalAmount,
                items: order.items,
                tenantId,
            });
            res.json({
                message: 'PDF generation enqueued asynchronously in BullMQ',
                jobId: job.id,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    /**
     * Download / Stream Rendered Invoice PDF
     */
    async getInvoicePdf(req, res) {
        try {
            const tenantId = req.tenantId;
            const { id } = req.params;
            const order = await Order_1.OrderModel.findOne({ tenantId, _id: id });
            if (!order)
                return res.status(404).json({ error: 'Order not found' });
            const fileName = `invoice-${order.orderNumber}.pdf`;
            const filePath = path_1.default.join(process.cwd(), 'storage', 'invoices', fileName);
            if (!fs_1.default.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'PDFNotReady',
                    message: 'PDF is being rendered asynchronously. Please retry in a few seconds.',
                });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
            const fileStream = fs_1.default.createReadStream(filePath);
            fileStream.pipe(res);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to download invoice' });
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
