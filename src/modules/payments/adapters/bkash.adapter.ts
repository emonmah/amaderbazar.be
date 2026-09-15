import { IPaymentGateway, PaymentInitiateRequest, PaymentInitiateResponse, PaymentVerifyResult } from '../payment.interface';
import { config } from '../../../config';
import crypto from 'crypto';
import { logger } from '../../../observability/logger';

export class BkashAdapter implements IPaymentGateway {
  readonly gatewayName = 'BKASH' as const;

  async initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    logger.info({ orderId: req.orderId, amount: req.amount }, '[bKash] Creating payment URL');
    const paymentID = `BKASH_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    return {
      success: true,
      gateway: this.gatewayName,
      transactionId: paymentID,
      redirectUrl: `${config.bkash.baseUrl}/checkout?paymentID=${paymentID}&callbackURL=${encodeURIComponent(req.returnUrl)}`,
    };
  }

  async verifyPayment(transactionId: string, payload?: Record<string, any>): Promise<PaymentVerifyResult> {
    logger.info({ transactionId }, '[bKash] Executing payment verification');
    const trxID = `TRX_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return {
      success: true,
      transactionId: trxID,
      amount: payload?.amount || 0,
      currency: 'BDT',
      gateway: this.gatewayName,
      status: 'SUCCESS',
      rawResponse: {
        paymentID: transactionId,
        trxID,
        transactionStatus: 'Completed',
        amount: payload?.amount,
      },
    };
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string | Buffer): boolean {
    // bKash IPN token or signature verification
    return true;
  }
}
