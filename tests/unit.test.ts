import { describe, it, expect } from 'vitest';
import { PaymentGatewayFactory } from '../src/modules/payments/payment.factory';
import { CourierFactory } from '../src/modules/logistics/courier.factory';
import { ROLE_PERMISSIONS, Permission } from '../src/middlewares/rbac.middleware';

describe('RBAC Role & Permission Matrix Tests', () => {
  it('SUPER_ADMIN should possess all system permissions', () => {
    const superAdminPerms = ROLE_PERMISSIONS.SUPER_ADMIN;
    expect(superAdminPerms).toContain(Permission.MANAGE_TENANTS);
    expect(superAdminPerms).toContain(Permission.VIEW_METRICS);
    expect(superAdminPerms).toContain(Permission.CREATE_PRODUCT);
    expect(superAdminPerms).toContain(Permission.VIEW_ORDERS);
  });

  it('WAREHOUSE_MANAGER should have inventory and dispatch permissions but not tenant management', () => {
    const warehousePerms = ROLE_PERMISSIONS.WAREHOUSE_MANAGER;
    expect(warehousePerms).toContain(Permission.MANAGE_INVENTORY);
    expect(warehousePerms).toContain(Permission.DISPATCH_ORDER);
    expect(warehousePerms).not.toContain(Permission.MANAGE_TENANTS);
  });

  it('CUSTOMER role should only have view catalog permissions', () => {
    const customerPerms = ROLE_PERMISSIONS.CUSTOMER;
    expect(customerPerms).toEqual([Permission.VIEW_CATALOG]);
  });
});

describe('Modular Payment Gateway Adapter Factory Tests', () => {
  it('should initialize StripeAdapter and create PaymentIntent', async () => {
    const stripe = PaymentGatewayFactory.getGateway('STRIPE');
    expect(stripe.gatewayName).toBe('STRIPE');

    const res = await stripe.initiatePayment({
      tenantId: 'tenant-001',
      orderId: 'order-123',
      amount: 99.99,
      currency: 'USD',
      customerEmail: 'buyer@test.com',
      returnUrl: 'http://localhost/return',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(res.success).toBe(true);
    expect(res.transactionId).toMatch(/^pi_/);
    expect(res.clientSecret).toBeDefined();
  });

  it('should initialize BkashAdapter and return payment URL', async () => {
    const bkash = PaymentGatewayFactory.getGateway('BKASH');
    expect(bkash.gatewayName).toBe('BKASH');

    const res = await bkash.initiatePayment({
      tenantId: 'tenant-001',
      orderId: 'order-456',
      amount: 1500,
      currency: 'BDT',
      customerEmail: 'user@bkash.test',
      returnUrl: 'http://localhost/callback',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(res.success).toBe(true);
    expect(res.redirectUrl).toContain('bka.sh');
  });

  it('should initialize SSLCommerzAdapter and return session key', async () => {
    const sslcz = PaymentGatewayFactory.getGateway('SSLCOMMERZ');
    expect(sslcz.gatewayName).toBe('SSLCOMMERZ');

    const res = await sslcz.initiatePayment({
      tenantId: 'tenant-001',
      orderId: 'order-789',
      amount: 2500,
      currency: 'BDT',
      customerEmail: 'user@sslcz.test',
      returnUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(res.success).toBe(true);
    expect(res.redirectUrl).toContain('sslcommerz.com');
  });

  it('should throw error on unknown payment gateway', () => {
    expect(() => PaymentGatewayFactory.getGateway('CRYPTO')).toThrow(
      /Unsupported payment gateway/
    );
  });
});

describe('Modular Courier Logistics Adapter Factory Tests', () => {
  it('should book consignment parcel with Steadfast', async () => {
    const steadfast = CourierFactory.getCourier('STEADFAST');
    expect(steadfast.courierName).toBe('STEADFAST');

    const res = await steadfast.createParcel({
      tenantId: 'tenant-001',
      orderId: 'order-999',
      recipientName: 'John Doe',
      recipientPhone: '+8801700000000',
      recipientAddress: 'Dhaka, Bangladesh',
      codAmount: 1500,
    });

    expect(res.success).toBe(true);
    expect(res.consignmentId).toMatch(/^STDF_/);
    expect(res.trackingCode).toBeDefined();
  });

  it('should book consignment parcel with Pathao', async () => {
    const pathao = CourierFactory.getCourier('PATHAO');
    expect(pathao.courierName).toBe('PATHAO');

    const res = await pathao.createParcel({
      tenantId: 'tenant-001',
      orderId: 'order-888',
      recipientName: 'Jane Doe',
      recipientPhone: '+8801800000000',
      recipientAddress: 'Gulshan 2, Dhaka',
      codAmount: 2000,
    });

    expect(res.success).toBe(true);
    expect(res.consignmentId).toMatch(/^PTH_/);
  });
});
