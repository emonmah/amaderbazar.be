"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRoutes = void 0;
const express_1 = require("express");
const catalog_controller_1 = require("./catalog.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// ==========================================
// Public Storefront Catalog
// ==========================================
router.get('/products', (req, res) => catalog_controller_1.catalogController.getProducts(req, res));
router.get('/products/:slug', (req, res) => catalog_controller_1.catalogController.getProductBySlug(req, res));
// Product Reviews
router.get('/products/:id/reviews', (req, res) => catalog_controller_1.catalogController.getProductReviews(req, res));
router.post('/products/:id/reviews', auth_middleware_1.optionalAuthenticate, (req, res) => catalog_controller_1.catalogController.createProductReview(req, res));
// Sliders / Banners
router.get('/sliders', (req, res) => catalog_controller_1.catalogController.getSliders(req, res));
router.post('/sliders', (req, res) => catalog_controller_1.catalogController.createSlider(req, res));
router.put('/sliders/:id', (req, res) => catalog_controller_1.catalogController.updateSlider(req, res));
router.delete('/sliders/:id', (req, res) => catalog_controller_1.catalogController.deleteSlider(req, res));
// Categories
router.get('/categories', (req, res) => catalog_controller_1.catalogController.getCategories(req, res));
router.post('/categories', (req, res) => catalog_controller_1.catalogController.createCategory(req, res));
router.put('/categories/:id', (req, res) => catalog_controller_1.catalogController.updateCategory(req, res));
router.delete('/categories/:id', (req, res) => catalog_controller_1.catalogController.deleteCategory(req, res));
// ==========================================
// Admin mutations (Products, Hot Deals, Discounts)
// ==========================================
router.post('/products', (req, res) => catalog_controller_1.catalogController.createProduct(req, res));
router.put('/products/:id', (req, res) => catalog_controller_1.catalogController.updateProduct(req, res));
router.patch('/products/:id/hot-deal', (req, res) => catalog_controller_1.catalogController.toggleHotDeal(req, res));
router.patch('/products/:id/discount', (req, res) => catalog_controller_1.catalogController.updateDiscount(req, res));
exports.catalogRoutes = router;
