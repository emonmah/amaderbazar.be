import { Request, Response } from 'express';
import { OrderModel } from '../../models/Order';
import { ProductModel } from '../../models/Product';
import { invoiceQueue } from '../../workers';
import fs from 'fs';
import path from 'path';
import { logger } from '../../observability/logger';

export class AdminController {
  /**
   * Kanban Board Data Provider
   * Organizes orders into status buckets for the admin Kanban board
   */
  async getKanbanOrders(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const orders = await OrderModel.find({ tenantId }).sort({ updatedAt: -1 }).lean();

      const kanban = {
        PENDING: orders.filter((o) => o.status === 'PENDING'),
        CONFIRMED: orders.filter((o) => o.status === 'CONFIRMED'),
        PACKED: orders.filter((o) => o.status === 'PACKED'),
        SHIPPED: orders.filter((o) => o.status === 'SHIPPED'),
        DELIVERED: orders.filter((o) => o.status === 'DELIVERED'),
      };

      res.json({ kanban, totalOrders: orders.length });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch kanban orders' });
    }
  }

  /**
   * SKU Variant Matrix & Warehouse Batches
   */
  async getInventoryMatrix(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const products = await ProductModel.find({ tenantId }).lean();

      const matrix = products.flatMap((product) =>
        product.variants.map((variant) => {
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
        })
      );

      res.json({ matrix, totalSkus: matrix.length });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch inventory matrix' });
    }
  }

  /**
   * Trigger Asynchronous PDF Invoice Generation
   */
  async triggerInvoiceGeneration(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const order = await OrderModel.findOne({ tenantId, _id: id });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const job = await invoiceQueue.add('generate-pdf-manual', {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Download / Stream Rendered Invoice PDF
   */
  async getInvoicePdf(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const order = await OrderModel.findOne({ tenantId, _id: id });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const fileName = `invoice-${order.orderNumber}.pdf`;
      const filePath = path.join(process.cwd(), 'storage', 'invoices', fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: 'PDFNotReady',
          message: 'PDF is being rendered asynchronously. Please retry in a few seconds.',
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to download invoice' });
    }
  }
}

export const adminController = new AdminController();
