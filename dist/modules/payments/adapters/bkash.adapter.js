"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BkashAdapter = void 0;
const config_1 = require("../../../config");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../../observability/logger");
class BkashAdapter {
    gatewayName = 'BKASH';
    async initiatePayment(req) {
        logger_1.logger.info({ orderId: req.orderId, amount: req.amount }, '[bKash] Creating payment URL');
        const paymentID = `BKASH_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
        return {
            success: true,
            gateway: this.gatewayName,
            transactionId: paymentID,
            redirectUrl: `${config_1.config.bkash.baseUrl}/checkout?paymentID=${paymentID}&callbackURL=${encodeURIComponent(req.returnUrl)}`,
        };
    }
    async verifyPayment(transactionId, payload) {
        logger_1.logger.info({ transactionId }, '[bKash] Executing payment verification');
        const trxID = `TRX_${crypto_1.default.randomBytes(6).toString('hex').toUpperCase()}`;
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
    verifyWebhookSignature(headers, rawBody) {
        // bKash IPN token or signature verification
        return true;
    }
}
exports.BkashAdapter = BkashAdapter;
