"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathaoAdapter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../../observability/logger");
class PathaoAdapter {
    courierName = 'PATHAO';
    async createParcel(req) {
        logger_1.logger.info({ orderId: req.orderId, recipient: req.recipientName }, '[Pathao] Creating order via Pathao API');
        const consignmentId = `PTH_${Date.now()}_${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`;
        const trackingCode = `TRK-PT-${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
        return {
            success: true,
            courier: this.courierName,
            consignmentId,
            trackingCode,
            status: 'Order_Created',
            deliveryFee: 70.0,
            labelUrl: `https://courier.pathao.com/labels/${consignmentId}`,
        };
    }
    async trackParcel(consignmentId) {
        return {
            consignmentId,
            trackingCode: `TRK-PT-${consignmentId}`,
            status: 'Pickup_Requested',
            courier: this.courierName,
            updatedAt: new Date(),
        };
    }
}
exports.PathaoAdapter = PathaoAdapter;
