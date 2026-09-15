import { Router } from 'express';
import { inventoryController } from './inventory.controller';

const router = Router();

router.post('/reserve', (req, res) => inventoryController.reserve(req, res));
router.post('/release', (req, res) => inventoryController.release(req, res));
router.get('/stock/:variantSku', (req, res) => inventoryController.getStock(req, res));

export const inventoryRoutes = router;
