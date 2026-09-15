import { IPaymentGateway } from './payment.interface';
import { StripeAdapter } from './adapters/stripe.adapter';
import { BkashAdapter } from './adapters/bkash.adapter';
import { SSLCommerzAdapter } from './adapters/sslcommerz.adapter';
import { CodAdapter } from './adapters/cod.adapter';

export class PaymentGatewayFactory {
  private static gateways: Map<string, IPaymentGateway> = new Map<string, IPaymentGateway>([
    ['STRIPE', new StripeAdapter()],
    ['BKASH', new BkashAdapter()],
    ['SSLCOMMERZ', new SSLCommerzAdapter()],
    ['COD', new CodAdapter()],
  ]);

  static getGateway(gatewayName: string): IPaymentGateway {
    const gateway = this.gateways.get(gatewayName.toUpperCase());
    if (!gateway) {
      throw new Error(`Unsupported payment gateway: ${gatewayName}. Supported: STRIPE, BKASH, SSLCOMMERZ, COD`);
    }
    return gateway;
  }
}
