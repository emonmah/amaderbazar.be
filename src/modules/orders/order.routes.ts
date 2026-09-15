import { Router } from 'express';
import { orderController } from './order.controller';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { requirePermission, Permission } from '../../middlewares/rbac.middleware';

const router = Router();

// Storefront & Authenticated Customer Checkout
router.post('/', (req, res) => orderController.createOrder(req, res));
router.get('/', optionalAuthenticate, (req, res) => orderController.getOrders(req, res));
router.get('/:id', optionalAuthenticate, (req, res) => orderController.getOrderById(req, res));

// Admin Status Transition
router.patch(
  '/:id/status',
  authenticate,
  requirePermission(Permission.UPDATE_ORDER_STATUS),
  (req, res) => orderController.transitionStatus(req, res)
);

export const orderRoutes = router;
