import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission, Permission } from '../../middlewares/rbac.middleware';

const router = Router();

router.get(
  '/orders/kanban',
  authenticate,
  requirePermission(Permission.VIEW_ORDERS),
  (req, res) => adminController.getKanbanOrders(req, res)
);

router.get(
  '/inventory/matrix',
  authenticate,
  requirePermission(Permission.VIEW_INVENTORY),
  (req, res) => adminController.getInventoryMatrix(req, res)
);

router.post(
  '/orders/:id/generate-invoice',
  authenticate,
  requirePermission(Permission.GENERATE_INVOICE),
  (req, res) => adminController.triggerInvoiceGeneration(req, res)
);

router.get('/orders/:id/invoice-pdf', (req, res) => adminController.getInvoicePdf(req, res));

export const adminRoutes = router;
