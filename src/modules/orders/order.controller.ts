import { Request, Response } from 'express';
import { orderService } from './order.service';
import { OrderModel } from '../../models/Order';
import { logger } from '../../observability/logger';

export class OrderController {
  async createOrder(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body.idempotencyKey;

      const { customerEmail, items, shippingAddress, paymentMethod } = req.body;

      if (!customerEmail || !items || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
        return res.status(400).json({ error: 'Missing required order fields' });
      }

      const { order, isDuplicate } = await orderService.createOrder({
        tenantId,
        customerId: req.user?.userId,
        customerEmail,
        items,
        shippingAddress,
        paymentMethod,
        idempotencyKey,
      });

      if (isDuplicate) {
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(200).json({
          message: 'Order already processed (idempotent replay)',
          order,
        });
      }

      res.status(201).json({
        message: 'Order placed successfully',
        order,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error creating order');
      res.status(500).json({ error: 'Failed to create order', message: error.message });
    }
  }

  async getOrders(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { status, email, customerId, page = '1', limit = '20' } = req.query;

      const query: any = { tenantId };
      if (status) query.status = status;
      if (req.user && req.user.role === 'CUSTOMER') {
        query.$or = [{ customerId: req.user.userId }, { customerEmail: req.user.email }];
      } else if (email) {
        query.customerEmail = email;
      } else if (customerId) {
        query.customerId = customerId;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const [orders, total] = await Promise.all([
        OrderModel.find(query)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        OrderModel.countDocuments(query),
      ]);

      res.json({
        orders,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
      const query = isObjectId ? { tenantId, $or: [{ _id: id }, { orderNumber: id }] } : { tenantId, orderNumber: id };

      const order = await OrderModel.findOne(query).lean();
      if (!order) return res.status(404).json({ error: 'Order not found' });

      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  }

  async transitionStatus(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;
      const { status, trackingNumber, courierName } = req.body;

      if (!status) return res.status(400).json({ error: 'status is required' });

      const updated = await orderService.transitionStatus(tenantId, id, status, {
        trackingNumber,
        courierName,
      });

      res.json({
        message: `Order transitioned to ${status}`,
        order: updated,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const orderController = new OrderController();
