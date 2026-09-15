"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteadfastAdapter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../../observability/logger");
class SteadfastAdapter {
    courierName = 'STEADFAST';
    async createParcel(req) {
        logger_1.logger.info({ orderId: req.orderId, recipient: req.recipientName }, '[Steadfast] Booking parcel dispatch');
        const consignmentId = `STDF_${Date.now()}_${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`;
        const trackingCode = `TRK-SF-${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
        return {
            success: true,
            courier: this.courierName,
            consignmentId,
            trackingCode,
            status: 'IN_REVIEW',
            deliveryFee: 60.0,
            labelUrl: `https://portal.packzy.com/labels/${consignmentId}.pdf`,
        };
    }
    async trackParcel(consignmentId) {
        return {
            consignmentId,
            trackingCode: `TRK-SF-${consignmentId}`,
            status: 'IN_TRANSIT',
            courier: this.courierName,
            updatedAt: new Date(),
        };
    }
}
exports.SteadfastAdapter = SteadfastAdapter;
