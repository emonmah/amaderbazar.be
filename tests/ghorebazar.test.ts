import { describe, it, expect } from 'vitest';
import { PaymentGatewayFactory } from '../src/modules/payments/payment.factory';

describe('Amader Bazar Payment & Features Tests', () => {
  it('should initialize COD Adapter and return success', async () => {
    const cod = PaymentGatewayFactory.getGateway('COD');
    expect(cod.gatewayName).toBe('COD');

    const res = await cod.initiatePayment({
      tenantId: 'tenant-fashion-001',
      orderId: 'order-ghorebazar-1',
      amount: 1450,
      currency: 'BDT',
      customerEmail: 'customer@gmail.com',
      returnUrl: 'http://localhost:3000/orders/success',
      cancelUrl: 'http://localhost:3000/orders/cancel',
    });

    expect(res.success).toBe(true);
    expect(res.transactionId).toMatch(/^COD_/);
    expect(res.redirectUrl).toContain('status=success');
  });

  it('should initialize bKash and SSLCommerz gateways', () => {
    const bkash = PaymentGatewayFactory.getGateway('BKASH');
    const sslcz = PaymentGatewayFactory.getGateway('SSLCOMMERZ');
    expect(bkash.gatewayName).toBe('BKASH');
    expect(sslcz.gatewayName).toBe('SSLCOMMERZ');
  });

  it('should calculate discount percentage correctly', () => {
    const basePrice = 1050;
    const compareAtPrice = 1250;
    const discountPercent = Math.round(((compareAtPrice - basePrice) / compareAtPrice) * 100);
    expect(discountPercent).toBe(16);
  });

  it('should generate valid category slugs from Bengali and English names', () => {
    const generateSlug = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-zA-Z0-9\u0980-\u09FF\s-]/g, '')
        .replace(/\s+/g, '-');

    expect(generateSlug('মধু ও ঘি')).toBe('মধু-ও-ঘি');
    expect(generateSlug('Tea & Coffee')).toBe('tea-coffee');
    expect(generateSlug('Organic Green Tea')).toBe('organic-green-tea');
  });
});
