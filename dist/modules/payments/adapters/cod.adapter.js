"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodAdapter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../../observability/logger");
class CodAdapter {
    gatewayName = 'COD';
    async initiatePayment(req) {
        logger_1.logger.info({ orderId: req.orderId, amount: req.amount }, '[Cash on Delivery] Order placed for cash settlement on delivery');
        const paymentID = `COD_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
        return {
            success: true,
            gateway: this.gatewayName,
            transactionId: paymentID,
            redirectUrl: `${req.returnUrl}?paymentID=${paymentID}&status=success`,
        };
    }
    async verifyPayment(transactionId, payload) {
        logger_1.logger.info({ transactionId }, '[Cash on Delivery] Verifying COD transaction');
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
    verifyWebhookSignature(headers, rawBody) {
        return true;
    }
}
exports.CodAdapter = CodAdapter;
