"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRoutes = void 0;
const express_1 = require("express");
const order_controller_1 = require("./order.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
// Storefront & Authenticated Customer Checkout
router.post('/', (req, res) => order_controller_1.orderController.createOrder(req, res));
router.get('/', auth_middleware_1.optionalAuthenticate, (req, res) => order_controller_1.orderController.getOrders(req, res));
router.get('/:id', auth_middleware_1.optionalAuthenticate, (req, res) => order_controller_1.orderController.getOrderById(req, res));
// Admin Status Transition
router.patch('/:id/status', auth_middleware_1.authenticate, (0, rbac_middleware_1.requirePermission)(rbac_middleware_1.Permission.UPDATE_ORDER_STATUS), (req, res) => order_controller_1.orderController.transitionStatus(req, res));
exports.orderRoutes = router;
