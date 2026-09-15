"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const tenantIsolation_plugin_1 = require("../plugins/tenantIsolation.plugin");
const OrderItemSchema = new mongoose_1.Schema({
    variantSku: { type: String, required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
}, { _id: false });
const ShippingAddressSchema = new mongoose_1.Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    zone: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'US' },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    tenantId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    customerId: { type: String, index: true },
    customerEmail: { type: String, required: true },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        default: 'PENDING',
        index: true,
    },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    paymentMethod: {
        type: String,
        enum: ['BKASH', 'SSLCOMMERZ', 'COD', 'STRIPE'],
        default: 'COD',
    },
    paymentStatus: {
        type: String,
        enum: ['UNPAID', 'PAID', 'REFUNDED'],
        default: 'UNPAID',
    },
    idempotencyKey: { type: String, sparse: true, index: true },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    trackingNumber: { type: String },
    courierName: { type: String },
    items: { type: [OrderItemSchema], default: [] },
}, { timestamps: true });
OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
OrderSchema.plugin(tenantIsolation_plugin_1.tenantIsolationPlugin);
exports.OrderModel = mongoose_1.default.model('Order', OrderSchema);
