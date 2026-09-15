import { Router } from 'express';
import { logisticsController } from './logistics.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission, Permission } from '../../middlewares/rbac.middleware';

const router = Router();

router.post(
  '/parcels',
  authenticate,
  requirePermission(Permission.DISPATCH_ORDER),
  (req, res) => logisticsController.createParcel(req, res)
);

router.get('/parcels/:consignmentId/track', (req, res) => logisticsController.trackParcel(req, res));
router.post('/webhook/:courier', (req, res) => logisticsController.handleCourierWebhook(req, res));

export const logisticsRoutes = router;
