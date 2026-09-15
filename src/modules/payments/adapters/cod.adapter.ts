import { IPaymentGateway, PaymentInitiateRequest, PaymentInitiateResponse, PaymentVerifyResult } from '../payment.interface';
import crypto from 'crypto';
import { logger } from '../../../observability/logger';

export class CodAdapter implements IPaymentGateway {
  readonly gatewayName = 'COD' as const;

  async initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    logger.info({ orderId: req.orderId, amount: req.amount }, '[Cash on Delivery] Order placed for cash settlement on delivery');
    const paymentID = `COD_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    return {
      success: true,
      gateway: this.gatewayName,
      transactionId: paymentID,
      redirectUrl: `${req.returnUrl}?paymentID=${paymentID}&status=success`,
    };
  }

  async verifyPayment(transactionId: string, payload?: Record<string, any>): Promise<PaymentVerifyResult> {
    logger.info({ transactionId }, '[Cash on Delivery] Verifying COD transaction');
    return {
      success: true,
      transactionId,
      amount: payload?.amount || 0,
      currency: 'BDT',
      gateway: this.gatewayName,
      status: 'SUCCESS',
      rawResponse: {
        paymentID: transactionId,
        paymentType: 'CASH_ON_DELIVERY',
        status: 'CONFIRMED_UNPAID_ON_DELIVERY',
      },
    };
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string | Buffer): boolean {
    return true;
  }
}
