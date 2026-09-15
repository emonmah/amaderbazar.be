import { Router } from 'express';
import { catalogController } from './catalog.controller';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';

const router = Router();

// ==========================================
// Public Storefront Catalog
// ==========================================
router.get('/products', (req, res) => catalogController.getProducts(req, res));
router.get('/products/:slug', (req, res) => catalogController.getProductBySlug(req, res));

// Product Reviews
router.get('/products/:id/reviews', (req, res) => catalogController.getProductReviews(req, res));
router.post('/products/:id/reviews', optionalAuthenticate, (req, res) => catalogController.createProductReview(req, res));

// Sliders / Banners
router.get('/sliders', (req, res) => catalogController.getSliders(req, res));
router.post('/sliders', (req, res) => catalogController.createSlider(req, res));
router.put('/sliders/:id', (req, res) => catalogController.updateSlider(req, res));
router.delete('/sliders/:id', (req, res) => catalogController.deleteSlider(req, res));

// Categories
router.get('/categories', (req, res) => catalogController.getCategories(req, res));
router.post('/categories', (req, res) => catalogController.createCategory(req, res));
router.put('/categories/:id', (req, res) => catalogController.updateCategory(req, res));
router.delete('/categories/:id', (req, res) => catalogController.deleteCategory(req, res));

// ==========================================
// Admin mutations (Products, Hot Deals, Discounts)
// ==========================================
router.post('/products', (req, res) => catalogController.createProduct(req, res));
router.put('/products/:id', (req, res) => catalogController.updateProduct(req, res));
router.patch('/products/:id/hot-deal', (req, res) => catalogController.toggleHotDeal(req, res));
router.patch('/products/:id/discount', (req, res) => catalogController.updateDiscount(req, res));

export const catalogRoutes = router;
