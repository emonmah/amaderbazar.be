import { Request, Response } from 'express';
import { CourierFactory } from './courier.factory';
import { ShipmentModel } from '../../models/Shipment';
import { OrderModel } from '../../models/Order';
import { logger } from '../../observability/logger';
import { eventDispatcher } from '../../events/eventDispatcher';

export class LogisticsController {
  async createParcel(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { orderId, courierName, recipientName, recipientPhone, recipientAddress, codAmount } = req.body;

      if (!orderId || !courierName) {
        return res.status(400).json({ error: 'orderId and courierName are required' });
      }

      const courier = CourierFactory.getCourier(courierName);
      const parcelRes = await courier.createParcel({
        tenantId,
        orderId,
        recipientName,
        recipientPhone,
        recipientAddress,
        codAmount: codAmount || 0,
      });

      const shipment = await ShipmentModel.create({
        tenantId,
        orderId,
        courier: courierName.toUpperCase(),
        consignmentId: parcelRes.consignmentId,
        trackingCode: parcelRes.trackingCode,
        status: parcelRes.status,
        labelUrl: parcelRes.labelUrl,
        recipientName,
        recipientPhone,
        deliveryAddress: recipientAddress,
      });

      // Update Order tracking metadata
      await OrderModel.findByIdAndUpdate(orderId, {
        trackingNumber: parcelRes.trackingCode,
        courierName: courierName.toUpperCase(),
        status: 'SHIPPED',
      });

      eventDispatcher.dispatch({
        type: 'shipment.created',
        tenantId,
        payload: { orderId, consignmentId: parcelRes.consignmentId, courier: courierName },
      });

      res.status(201).json({
        message: 'Parcel booked with courier',
        shipment,
      });
    } catch (error: any) {
      logger.error({ error }, 'Error creating courier parcel');
      res.status(500).json({ error: error.message });
    }
  }

  async trackParcel(req: Request, res: Response) {
    try {
      const { consignmentId } = req.params;
      const { courier: courierName } = req.query;

      const courier = CourierFactory.getCourier((courierName as string) || 'STEADFAST');
      const tracking = await courier.trackParcel(consignmentId);
      res.json(tracking);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async handleCourierWebhook(req: Request, res: Response) {
    try {
      const { courier } = req.params;
      const { consignment_id, status } = req.body;

      logger.info({ courier, consignment_id, status }, 'Received courier webhook status update');

      if (consignment_id && status) {
        await ShipmentModel.findOneAndUpdate(
          { consignmentId: consignment_id },
          { $set: { status } }
        );
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const logisticsController = new LogisticsController();
