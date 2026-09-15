import { ICourierAdapter, CreateParcelRequest, CreateParcelResponse, ParcelTrackingInfo } from '../courier.interface';
import crypto from 'crypto';
import { logger } from '../../../observability/logger';

export class SteadfastAdapter implements ICourierAdapter {
  readonly courierName = 'STEADFAST' as const;

  async createParcel(req: CreateParcelRequest): Promise<CreateParcelResponse> {
    logger.info({ orderId: req.orderId, recipient: req.recipientName }, '[Steadfast] Booking parcel dispatch');
    const consignmentId = `STDF_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const trackingCode = `TRK-SF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    return {
      success: true,
      courier: this.courierName,
      consignmentId,
      trackingCode,
      status: 'IN_REVIEW',
      deliveryFee: 60.0,
      labelUrl: `https://portal.packzy.com/labels/${consignmentId}.pdf`,
    };
  }

  async trackParcel(consignmentId: string): Promise<ParcelTrackingInfo> {
    return {
      consignmentId,
      trackingCode: `TRK-SF-${consignmentId}`,
      status: 'IN_TRANSIT',
      courier: this.courierName,
      updatedAt: new Date(),
    };
  }
}
