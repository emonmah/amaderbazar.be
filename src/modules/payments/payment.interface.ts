export interface PaymentInitiateRequest {
  tenantId: string;
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerPhone?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentInitiateResponse {
  success: boolean;
  gateway: string;
  redirectUrl?: string;
  clientSecret?: string;
  transactionId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerifyResult {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  gateway: string;
  status: 'SUCCESS' | 'FAILED';
  rawResponse: Record<string, any>;
}

export interface IPaymentGateway {
  readonly gatewayName: 'STRIPE' | 'BKASH' | 'SSLCOMMERZ' | 'COD';
  initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResponse>;
  verifyPayment(transactionId: string, payload?: Record<string, any>): Promise<PaymentVerifyResult>;
  verifyWebhookSignature(headers: Record<string, any>, rawBody: string | Buffer): boolean;
}
