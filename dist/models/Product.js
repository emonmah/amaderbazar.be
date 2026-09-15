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
exports.ProductModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const tenantIsolation_plugin_1 = require("../plugins/tenantIsolation.plugin");
const InventoryBatchSchema = new mongoose_1.Schema({
    batchNumber: { type: String, required: true },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    warehouseLocation: { type: String },
    expiryDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const ProductVariantSchema = new mongoose_1.Schema({
    sku: { type: String, required: true },
    color: { type: String },
    size: { type: String },
    unitWeightKg: { type: Number },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number },
    batches: { type: [InventoryBatchSchema], default: [] },
}, { _id: true });
const ProductSchema = new mongoose_1.Schema({
    tenantId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    basePrice: { type: Number, required: true },
    compareAtPrice: { type: Number },
    discountPercent: { type: Number, default: 0 },
    isHotDeal: { type: Boolean, default: false, index: true },
    unit: { type: String, default: '1 pc' },
    rating: { type: Number, default: 5 },
    numReviews: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
    images: { type: [String], default: [] },
    attributes: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    variants: { type: [ProductVariantSchema], default: [] },
}, { timestamps: true });
ProductSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, 'variants.sku': 1 });
ProductSchema.index({ tenantId: 1, category: 1, isPublished: 1 });
ProductSchema.index({ tenantId: 1, isHotDeal: 1, isPublished: 1 });
ProductSchema.plugin(tenantIsolation_plugin_1.tenantIsolationPlugin);
exports.ProductModel = mongoose_1.default.model('Product', ProductSchema);
