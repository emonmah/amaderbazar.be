"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logisticsController = exports.LogisticsController = void 0;
const courier_factory_1 = require("./courier.factory");
const Shipment_1 = require("../../models/Shipment");
const Order_1 = require("../../models/Order");
const logger_1 = require("../../observability/logger");
const eventDispatcher_1 = require("../../events/eventDispatcher");
class LogisticsController {
    async createParcel(req, res) {
        try {
            const tenantId = req.tenantId;
            const { orderId, courierName, recipientName, recipientPhone, recipientAddress, codAmount } = req.body;
            if (!orderId || !courierName) {
                return res.status(400).json({ error: 'orderId and courierName are required' });
            }
            const courier = courier_factory_1.CourierFactory.getCourier(courierName);
            const parcelRes = await courier.createParcel({
                tenantId,
                orderId,
                recipientName,
                recipientPhone,
                recipientAddress,
                codAmount: codAmount || 0,
            });
            const shipment = await Shipment_1.ShipmentModel.create({
                tenantId,
                orderId,
                courier: courierName.toUpperCase(),
                consignmentId: parcelRes.consignmentId,
                trackingCode: parcelRes.trackingCode,
                status: parcelRes.status,
                labelUrl: parcelRes.labelUrl,
                recipientName,
                recipientPhone,
                deliveryAddress: recipientAddress,
            });
            // Update Order tracking metadata
            await Order_1.OrderModel.findByIdAndUpdate(orderId, {
                trackingNumber: parcelRes.trackingCode,
                courierName: courierName.toUpperCase(),
                status: 'SHIPPED',
            });
            eventDispatcher_1.eventDispatcher.dispatch({
                type: 'shipment.created',
                tenantId,
                payload: { orderId, consignmentId: parcelRes.consignmentId, courier: courierName },
            });
            res.status(201).json({
                message: 'Parcel booked with courier',
                shipment,
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error creating courier parcel');
            res.status(500).json({ error: error.message });
        }
    }
    async trackParcel(req, res) {
        try {
            const { consignmentId } = req.params;
            const { courier: courierName } = req.query;
            const courier = courier_factory_1.CourierFactory.getCourier(courierName || 'STEADFAST');
            const tracking = await courier.trackParcel(consignmentId);
            res.json(tracking);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async handleCourierWebhook(req, res) {
        try {
            const { courier } = req.params;
            const { consignment_id, status } = req.body;
            logger_1.logger.info({ courier, consignment_id, status }, 'Received courier webhook status update');
            if (consignment_id && status) {
                await Shipment_1.ShipmentModel.findOneAndUpdate({ consignmentId: consignment_id }, { $set: { status } });
            }
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.LogisticsController = LogisticsController;
exports.logisticsController = new LogisticsController();
