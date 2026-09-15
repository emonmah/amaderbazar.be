import { Request, Response } from 'express';
import { PaymentGatewayFactory } from './payment.factory';
import { PaymentModel } from '../../models/Payment';
import { OrderModel } from '../../models/Order';
import { logger } from '../../observability/logger';
import { eventDispatcher } from '../../events/eventDispatcher';

export class PaymentController {
  async initiatePayment(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { orderId, gateway, returnUrl, cancelUrl } = req.body;

      if (!orderId || !gateway) {
        return res.status(400).json({ error: 'orderId and gateway are required' });
      }

      const order = await OrderModel.findOne({ tenantId, _id: orderId });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const paymentGateway = PaymentGatewayFactory.getGateway(gateway);
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
      const payment = await PaymentModel.create({
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
    } catch (error: any) {
      logger.error({ error }, 'Error initiating payment');
      res.status(500).json({ error: error.message });
    }
  }

  async verifyPayment(req: Request, res: Response) {
    try {
      const { gateway } = req.params;
      const { transactionId } = req.body;

      const paymentGateway = PaymentGatewayFactory.getGateway(gateway);
      const verification = await paymentGateway.verifyPayment(transactionId, req.body);

      if (verification.success && verification.status === 'SUCCESS') {
        const payment = await PaymentModel.findOneAndUpdate(
          { transactionId },
          { $set: { status: 'SUCCESS', rawResponse: verification.rawResponse } },
          { new: true }
        );

        if (payment) {
          await OrderModel.findByIdAndUpdate(payment.orderId, { status: 'CONFIRMED' });
          eventDispatcher.dispatch({
            type: 'payment.completed',
            tenantId: payment.tenantId,
            payload: { orderId: payment.orderId, transactionId, amount: payment.amount },
          });
        }
      }

      res.json(verification);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async handleWebhook(req: Request, res: Response) {
    try {
      const { gateway } = req.params;
      const paymentGateway = PaymentGatewayFactory.getGateway(gateway);

      const isValid = paymentGateway.verifyWebhookSignature(req.headers, req.body);
      if (!isValid) {
        logger.warn({ gateway }, 'Invalid webhook signature received');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      logger.info({ gateway, body: req.body }, 'Webhook verified and processed');
      res.status(200).json({ received: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const paymentController = new PaymentController();
