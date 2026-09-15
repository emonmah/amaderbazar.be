"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentGatewayFactory = void 0;
const stripe_adapter_1 = require("./adapters/stripe.adapter");
const bkash_adapter_1 = require("./adapters/bkash.adapter");
const sslcommerz_adapter_1 = require("./adapters/sslcommerz.adapter");
const cod_adapter_1 = require("./adapters/cod.adapter");
class PaymentGatewayFactory {
    static gateways = new Map([
        ['STRIPE', new stripe_adapter_1.StripeAdapter()],
        ['BKASH', new bkash_adapter_1.BkashAdapter()],
        ['SSLCOMMERZ', new sslcommerz_adapter_1.SSLCommerzAdapter()],
        ['COD', new cod_adapter_1.CodAdapter()],
    ]);
    static getGateway(gatewayName) {
        const gateway = this.gateways.get(gatewayName.toUpperCase());
        if (!gateway) {
            throw new Error(`Unsupported payment gateway: ${gatewayName}. Supported: STRIPE, BKASH, SSLCOMMERZ, COD`);
        }
        return gateway;
    }
}
exports.PaymentGatewayFactory = PaymentGatewayFactory;
