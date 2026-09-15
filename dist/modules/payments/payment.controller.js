"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = exports.PaymentController = void 0;
const payment_factory_1 = require("./payment.factory");
const Payment_1 = require("../../models/Payment");
const Order_1 = require("../../models/Order");
const logger_1 = require("../../observability/logger");
const eventDispatcher_1 = require("../../events/eventDispatcher");
class PaymentController {
    async initiatePayment(req, res) {
        try {
            const tenantId = req.tenantId;
            const { orderId, gateway, returnUrl, cancelUrl } = req.body;
            if (!orderId || !gateway) {
                return res.status(400).json({ error: 'orderId and gateway are required' });
            }
            const order = await Order_1.OrderModel.findOne({ tenantId, _id: orderId });
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            const paymentGateway = payment_factory_1.PaymentGatewayFactory.getGateway(gateway);
            const initiateResult = await paymentGateway.initiatePayment({
                tenantId,
                orderId,
                amount: order.totalAmount,
                currency: order.currency,
                customerEmail: order.customerEmail,
                customerPhone: order.shippingAddress.phone,
                returnUrl: returnUrl || `http://localhost:3000/checkout/success?orderId=${orderId}`,
                cancelUrl: cancelUrl || `http://localhost:3000/checkout/cancel?orderId=${orderId}`,
            });
            // Record Payment in MongoDB
            const payment = await Payment_1.PaymentModel.create({
                tenantId,
                orderId,
                gateway: gateway.toUpperCase(),
                transactionId: initiateResult.transactionId,
                amount: order.totalAmount,
                currency: order.currency,
                status: 'PENDING',
            });
            res.status(200).json({
                message: 'Payment initialized',
                paymentId: payment._id,
                ...initiateResult,
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error initiating payment');
            res.status(500).json({ error: error.message });
        }
    }
    async verifyPayment(req, res) {
        try {
            const { gateway } = req.params;
            const { transactionId } = req.body;
            const paymentGateway = payment_factory_1.PaymentGatewayFactory.getGateway(gateway);
            const verification = await paymentGateway.verifyPayment(transactionId, req.body);
            if (verification.success && verification.status === 'SUCCESS') {
                const payment = await Payment_1.PaymentModel.findOneAndUpdate({ transactionId }, { $set: { status: 'SUCCESS', rawResponse: verification.rawResponse } }, { new: true });
                if (payment) {
                    await Order_1.OrderModel.findByIdAndUpdate(payment.orderId, { status: 'CONFIRMED' });
                    eventDispatcher_1.eventDispatcher.dispatch({
                        type: 'payment.completed',
                        tenantId: payment.tenantId,
                        payload: { orderId: payment.orderId, transactionId, amount: payment.amount },
                    });
                }
            }
            res.json(verification);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async handleWebhook(req, res) {
        try {
            const { gateway } = req.params;
            const paymentGateway = payment_factory_1.PaymentGatewayFactory.getGateway(gateway);
            const isValid = paymentGateway.verifyWebhookSignature(req.headers, req.body);
            if (!isValid) {
                logger_1.logger.warn({ gateway }, 'Invalid webhook signature received');
                return res.status(400).json({ error: 'Invalid webhook signature' });
            }
            logger_1.logger.info({ gateway, body: req.body }, 'Webhook verified and processed');
            res.status(200).json({ received: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.PaymentController = PaymentController;
exports.paymentController = new PaymentController();
