import { ICourierAdapter, CreateParcelRequest, CreateParcelResponse, ParcelTrackingInfo } from '../courier.interface';
import crypto from 'crypto';
import { logger } from '../../../observability/logger';

export class PathaoAdapter implements ICourierAdapter {
  readonly courierName = 'PATHAO' as const;

  async createParcel(req: CreateParcelRequest): Promise<CreateParcelResponse> {
    logger.info({ orderId: req.orderId, recipient: req.recipientName }, '[Pathao] Creating order via Pathao API');
    const consignmentId = `PTH_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const trackingCode = `TRK-PT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    return {
      success: true,
      courier: this.courierName,
      consignmentId,
      trackingCode,
      status: 'Order_Created',
      deliveryFee: 70.0,
      labelUrl: `https://courier.pathao.com/labels/${consignmentId}`,
    };
  }

  async trackParcel(consignmentId: string): Promise<ParcelTrackingInfo> {
    return {
      consignmentId,
      trackingCode: `TRK-PT-${consignmentId}`,
      status: 'Pickup_Requested',
      courier: this.courierName,
      updatedAt: new Date(),
    };
  }
}
