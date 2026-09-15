import { Router } from 'express';
import { paymentController } from './payment.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/initiate', (req, res) => paymentController.initiatePayment(req, res));
router.post('/verify/:gateway', (req, res) => paymentController.verifyPayment(req, res));
router.post('/webhook/:gateway', (req, res) => paymentController.handleWebhook(req, res));

export const paymentRoutes = router;
