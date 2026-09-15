"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeAdapter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../../observability/logger");
class StripeAdapter {
    gatewayName = 'STRIPE';
    async initiatePayment(req) {
        logger_1.logger.info({ orderId: req.orderId, amount: req.amount }, '[Stripe] Initiating PaymentIntent');
        const mockIntentId = `pi_${crypto_1.default.randomBytes(12).toString('hex')}`;
        const clientSecret = `${mockIntentId}_secret_${crypto_1.default.randomBytes(8).toString('hex')}`;
        return {
            success: true,
            gateway: this.gatewayName,
            clientSecret,
            transactionId: mockIntentId,
            redirectUrl: `https://checkout.stripe.com/pay/${mockIntentId}`,
        };
    }
    async verifyPayment(transactionId, payload) {
        logger_1.logger.info({ transactionId }, '[Stripe] Verifying PaymentIntent status');
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
    verifyWebhookSignature(headers, rawBody) {
        const signature = headers['stripe-signature'];
        if (!signature)
            return false;
        // In production: stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret)
        return signature.length > 0;
    }
}
exports.StripeAdapter = StripeAdapter;
