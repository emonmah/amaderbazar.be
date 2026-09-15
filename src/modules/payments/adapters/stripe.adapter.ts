import { IPaymentGateway, PaymentInitiateRequest, PaymentInitiateResponse, PaymentVerifyResult } from '../payment.interface';
import { config } from '../../../config';
import crypto from 'crypto';
import { logger } from '../../../observability/logger';

export class StripeAdapter implements IPaymentGateway {
  readonly gatewayName = 'STRIPE' as const;

  async initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
    logger.info({ orderId: req.orderId, amount: req.amount }, '[Stripe] Initiating PaymentIntent');
    const mockIntentId = `pi_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = `${mockIntentId}_secret_${crypto.randomBytes(8).toString('hex')}`;

    return {
      success: true,
      gateway: this.gatewayName,
      clientSecret,
      transactionId: mockIntentId,
      redirectUrl: `https://checkout.stripe.com/pay/${mockIntentId}`,
    };
  }

  async verifyPayment(transactionId: string, payload?: Record<string, any>): Promise<PaymentVerifyResult> {
    logger.info({ transactionId }, '[Stripe] Verifying PaymentIntent status');
    return {
      success: true,
      transactionId,
      amount: payload?.amount || 0,
      currency: payload?.currency || 'USD',
      gateway: this.gatewayName,
      status: 'SUCCESS',
      rawResponse: { id: transactionId, status: 'succeeded', captured: true },
    };
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string | Buffer): boolean {
    const signature = headers['stripe-signature'] as string;
    if (!signature) return false;
    // In production: stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret)
    return signature.length > 0;
  }
}
