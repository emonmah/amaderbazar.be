"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
const Tenant_1 = require("../models/Tenant");
const User_1 = require("../models/User");
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const Slider_1 = require("../models/Slider");
const Review_1 = require("../models/Review");
async function seedDatabase() {
    console.log('🌱 Starting MongoDB seed for Amader Bazar E-Commerce...');
    await mongoose_1.default.connect(config_1.config.mongoUri);
    // Clear existing collections & drop indexes to avoid index collisions
    try {
        await mongoose_1.default.connection.collection('orders').drop();
    }
    catch (e) { }
    await Promise.all([
        Tenant_1.TenantModel.deleteMany({}),
        User_1.UserModel.deleteMany({}),
        Product_1.ProductModel.deleteMany({}),
        Order_1.OrderModel.deleteMany({}),
        Slider_1.SliderModel.deleteMany({}),
        Review_1.ReviewModel.deleteMany({}),
    ]);
    const passwordHash = await bcryptjs_1.default.hash('Password123!', 10);
    // 1. Create Tenant (Amader Bazar)
    const tenantAmaderBazar = await Tenant_1.TenantModel.create({
        tenantId: 'tenant-fashion-001',
        slug: 'amaderbazar',
        name: 'আমাদের বাজার (Amader Bazar) - Pure & Organic',
        domain: 'amaderbazar.platform.local',
        mode: 'STANDALONE',
        settings: {
            currency: 'BDT',
            primaryColor: '#16A34A',
            lowStockThresholdDefault: 5,
            reservationHoldMinutes: 10,
            paymentGateways: ['BKASH', 'SSLCOMMERZ', 'COD', 'STRIPE'],
            courierProvider: 'STEADFAST',
        },
    });
    console.log(`✅ Tenant created: ${tenantAmaderBazar.name}`);
    // 2. Create RBAC Users
    const users = await User_1.UserModel.create([
        {
            tenantId: tenantAmaderBazar.tenantId,
            email: 'admin@amaderbazar.com',
            passwordHash,
            name: 'Amader Bazar Super Admin',
            role: 'SUPER_ADMIN',
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            email: 'owner@amaderbazar.com',
            passwordHash,
            name: 'Tareq Store Owner',
            role: 'STORE_OWNER',
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            email: 'customer@gmail.com',
            passwordHash,
            name: 'Rahim Ahmed',
            role: 'CUSTOMER',
        },
    ]);
    console.log(`✅ Seeded ${users.length} RBAC Users`);
    // 3. Create Authentic Ghorebazar Products
    const products = await Product_1.ProductModel.create([
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Sundarban Raw Natural Honey (সুন্দরবন প্রাকৃতিক মধু)',
            slug: 'sundarban-raw-natural-honey',
            description: '১০০% খাঁটি ও কাঁচা সুন্দরবনের প্রাকৃতিক মধু। সরাসরি মৌয়ালদের মাধ্যমে সুন্দরবনের গভীর অরণ্য থেকে সংগৃহীত। কোনো প্রকার কৃত্রিম চিনি বা তাপ প্রয়োগ করা হয়নি।',
            category: 'মধু ও ঘি',
            basePrice: 1050,
            compareAtPrice: 1250,
            discountPercent: 16,
            isHotDeal: true,
            unit: '1 kg',
            rating: 4.9,
            numReviews: 28,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                origin: 'Sundarbans, Khulna',
                type: 'Raw Unprocessed Honey',
                purity: '100% Guaranteed',
            },
            variants: [
                {
                    sku: 'GB-HNY-1KG',
                    color: 'Golden Amber',
                    size: '1 kg',
                    price: 1050,
                    compareAtPrice: 1250,
                    batches: [{ batchNumber: 'BATCH-HNY-01', quantity: 60, reservedQuantity: 0, lowStockThreshold: 10 }],
                },
                {
                    sku: 'GB-HNY-500G',
                    color: 'Golden Amber',
                    size: '500 gm',
                    price: 580,
                    compareAtPrice: 650,
                    batches: [{ batchNumber: 'BATCH-HNY-02', quantity: 40, reservedQuantity: 0, lowStockThreshold: 8 }],
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Wood Pressed Pure Mustard Oil (ঘানি ভাঙা খাঁটি সরিষার তেল)',
            slug: 'wood-pressed-mustard-oil',
            description: 'কাঠের ঘানিতে ভাঙানো খাঁটি দেশি মাঘী সরিষার তেল। এর প্রাকৃতিক ঝাঁঝ ও সুঘ্রাণ তরকারির স্বাদ বাড়িয়ে দেয় বহুগুণ। কোলেস্টেরল মুক্ত ও সম্পূর্ণ স্বাস্থ্যসম্মত।',
            category: 'তেল ও বীজ',
            basePrice: 1450,
            compareAtPrice: 1650,
            discountPercent: 12,
            isHotDeal: true,
            unit: '5 Liter',
            rating: 4.8,
            numReviews: 42,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                process: 'Cold Wood Pressed (কাঠের ঘানি)',
                seed: 'Local Maghi Mustard',
            },
            variants: [
                {
                    sku: 'GB-OIL-5L',
                    size: '5 Liter',
                    price: 1450,
                    compareAtPrice: 1650,
                    batches: [{ batchNumber: 'BATCH-OIL-01', quantity: 35, reservedQuantity: 0, lowStockThreshold: 5 }],
                },
                {
                    sku: 'GB-OIL-1L',
                    size: '1 Liter',
                    price: 320,
                    compareAtPrice: 360,
                    batches: [{ batchNumber: 'BATCH-OIL-02', quantity: 50, reservedQuantity: 0, lowStockThreshold: 10 }],
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Premium Organic Cow Ghee (গাওয়া ঘি - স্পেশাল সুগন্ধি)',
            slug: 'premium-organic-cow-ghee',
            description: 'পাবনার চাটমোহর ও সিরাজগঞ্জের বাথানের দেশি গরুর খাঁটি দুধের মাখন থেকে তৈরি সুস্বাদু দানাদার গাওয়া ঘি। কোনো কৃত্রিম রঙ বা প্রিজারভেটিভ নেই।',
            category: 'মধু ও ঘি',
            basePrice: 950,
            compareAtPrice: 1150,
            discountPercent: 17,
            isHotDeal: true,
            unit: '500 gm',
            rating: 5.0,
            numReviews: 35,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                milkSource: '100% Pure Cow Milk',
                texture: 'Granular (দানাদার)',
            },
            variants: [
                {
                    sku: 'GB-GHEE-500G',
                    size: '500 gm',
                    price: 950,
                    compareAtPrice: 1150,
                    batches: [{ batchNumber: 'BATCH-GHEE-01', quantity: 45, reservedQuantity: 0, lowStockThreshold: 10 }],
                },
                {
                    sku: 'GB-GHEE-1KG',
                    size: '1 kg',
                    price: 1850,
                    compareAtPrice: 2200,
                    batches: [{ batchNumber: 'BATCH-GHEE-02', quantity: 25, reservedQuantity: 0, lowStockThreshold: 5 }],
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Premium Medjool Dates (প্রিমিয়াম মেডজুল খেজুর)',
            slug: 'premium-medjool-dates',
            description: 'মদিনার সবচেয়ে বড় সাইজের নরম, মিষ্টি ও রসালো প্রিমিয়াম জাম্বো মেডজুল খেজুর। সম্পূর্ণ প্রাকৃতিক মিষ্টিতে ভরপুর, কোনো প্রকার গ্লুকোজ বা শিরা মেশানো নেই।',
            category: 'ড্রাই ফ্রুটস ও বাদাম',
            basePrice: 1350,
            compareAtPrice: 1600,
            discountPercent: 15,
            isHotDeal: true,
            unit: '1 kg',
            rating: 4.9,
            numReviews: 50,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1549488344-cbb6c34cf08b?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                grade: 'Jumbo Premium Medjool',
                origin: 'Madinah, KSA',
            },
            variants: [
                {
                    sku: 'GB-DTE-1KG',
                    size: '1 kg',
                    price: 1350,
                    compareAtPrice: 1600,
                    batches: [{ batchNumber: 'BATCH-DTE-01', quantity: 70, reservedQuantity: 0, lowStockThreshold: 10 }],
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Organic Chia Seeds (অর্গানিক চিয়া সিড)',
            slug: 'organic-chia-seeds',
            description: 'উচ্চমানের ওমেগা-৩ ও ফাইবার সমৃদ্ধ অর্গানিক চিয়া সিড। শরীরের অতিরিক্ত মেদ কমাতে এবং হজমশক্তি ও শক্তি বৃদ্ধি করতে অত্যন্ত কার্যকর সুপারফুড।',
            category: 'তেল ও বীজ',
            basePrice: 420,
            compareAtPrice: 520,
            discountPercent: 19,
            isHotDeal: false,
            unit: '500 gm',
            rating: 4.7,
            numReviews: 19,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                purity: 'Grade A Cleaned',
            },
            variants: [
                {
                    sku: 'GB-CHIA-500G',
                    size: '500 gm',
                    price: 420,
                    compareAtPrice: 520,
                    batches: [{ batchNumber: 'BATCH-CHIA-01', quantity: 55, reservedQuantity: 0, lowStockThreshold: 10 }],
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Mixed Dry Fruits & Premium Nuts (ড্রাই ফ্রুটস ও বাদাম মিক্স)',
            slug: 'mixed-dry-fruits-nuts',
            description: 'কাজু বাদাম, কাঠবাদাম, পেস্তা বাদাম, আখরোট, কিশমিশ এবং প্রিমিয়াম খেজুরের বিশেষ স্বাস্থ্যকর মিশ্রণ। প্রতিদিনের শারীরিক শক্তির জন্য আদর্শ স্নাক্স।',
            category: 'ড্রাই ফ্রুটস ও বাদাম',
            basePrice: 850,
            compareAtPrice: 1000,
            discountPercent: 15,
            isHotDeal: false,
            unit: '500 gm',
            rating: 4.8,
            numReviews: 24,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                ingredients: 'Almonds, Cashews, Pistachios, Walnuts, Raisins',
            },
            variants: [
                {
                    sku: 'GB-NUT-500G',
                    size: '500 gm',
                    price: 850,
                    compareAtPrice: 1000,
                    batches: [{ batchNumber: 'BATCH-NUT-01', quantity: 30, reservedQuantity: 0, lowStockThreshold: 6 }],
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Cold-Pressed Black Cumin Oil (কালোজিরা তেল)',
            slug: 'cold-pressed-black-cumin-oil',
            description: 'মৃত্যু ব্যতীত সর্বরোগের মহৌষধ খাঁটি কালোজিরা তেল। ১০০% বিশুদ্ধ দেশি কালোজিরা কোল্ড প্রসেসে চাপ দিয়ে তেল নিষ্কাশন করা হয়েছে।',
            category: 'তেল ও বীজ',
            basePrice: 650,
            compareAtPrice: 750,
            discountPercent: 13,
            isHotDeal: false,
            unit: '250 ml',
            rating: 4.9,
            numReviews: 16,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                process: 'Cold Pressed Unrefined',
            },
            variants: [
                {
                    sku: 'GB-KAL-250ML',
                    size: '250 ml',
                    price: 650,
                    compareAtPrice: 750,
                    batches: [{ batchNumber: 'BATCH-KAL-01', quantity: 45, reservedQuantity: 0, lowStockThreshold: 10 }],
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'Premium Daawat Basmati Rice (দাওয়াত বাসমতি চাল)',
            slug: 'premium-daawat-basmati-rice',
            description: 'অতিরিক্ত লম্বা দানা, মন মাতানো সুবাস ও ঝরঝরে স্বাদের প্রিমিয়াম বিরিয়ানি ও পোলাওয়ের বাসমতি চাল। প্রতিটি দানায় পাবেন রাজকীয় স্বাদ।',
            category: 'মসলা ও ডাল',
            basePrice: 1850,
            compareAtPrice: 2100,
            discountPercent: 12,
            isHotDeal: false,
            unit: '5 kg',
            rating: 4.8,
            numReviews: 38,
            isPublished: true,
            images: [
                'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
            ],
            attributes: {
                grainLength: 'Extra Long Grain',
                aging: '2 Years Aged',
            },
            variants: [
                {
                    sku: 'GB-RICE-5KG',
                    size: '5 kg',
                    price: 1850,
                    compareAtPrice: 2100,
                    batches: [{ batchNumber: 'BATCH-RICE-01', quantity: 50, reservedQuantity: 0, lowStockThreshold: 10 }],
                },
            ],
        },
    ]);
    console.log(`✅ Seeded ${products.length} Products with Hot Deals, Discounts & Reviews`);
    // 4. Create Hero Sliders
    await Slider_1.SliderModel.create([
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'খাঁটি ও প্রাকৃতিক পণ্যের বিশ্বস্ত প্রতিষ্ঠান',
            subtitle: '১০০% ভেজালমুক্ত সুন্দরবনের খাঁটি মধু, ঘানি ভাঙা সরিষার তেল ও প্রিমিয়াম গাওয়া ঘি সরাসরি ঘরে ডেলিভারি নিন।',
            badge: '🔥 বিশেষ ছাড় - ২০% পর্যন্ত ক্যাশব্যাক!',
            imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80',
            linkUrl: '/#catalog',
            buttonText: 'অর্ডার করুন',
            displayOrder: 1,
            isActive: true,
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'সুন্দরবনের ১০০% প্রাকৃতিক চাকের মধু',
            subtitle: 'সরাসরি সুন্দরবনের গভীর অরণ্যের মৌয়ালদের থেকে সংগৃহীত। কোনো প্রকার কৃত্রিম চিনি বা তাপমুক্ত প্রাকৃতিক গুণাবলী।',
            badge: '⭐ সেরা হট ডিল অফার',
            imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1600&q=80',
            linkUrl: '/products/sundarban-raw-natural-honey',
            buttonText: 'মধু কিনুন',
            displayOrder: 2,
            isActive: true,
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            title: 'প্রিমিয়াম মেডজুল খেজুর ও ড্রাই ফ্রুটস',
            subtitle: 'মদিনার বাছাইকৃত রসালো জাম্বো মেডজুল খেজুর ও উন্নতমানের বাদামের স্বাস্থ্যকর কম্বো।',
            badge: '🌿 অর্গানিক ও ফ্রেশ',
            imageUrl: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=1600&q=80',
            linkUrl: '/products/premium-medjool-dates',
            buttonText: 'কালেকশন দেখুন',
            displayOrder: 3,
            isActive: true,
        },
    ]);
    console.log('✅ Seeded B2C Hero Sliders');
    // 5. Seed Reviews
    const honey = products[0];
    await Review_1.ReviewModel.create([
        {
            tenantId: tenantAmaderBazar.tenantId,
            productId: honey._id,
            userName: 'Tanvir Hasan',
            userEmail: 'tanvir@gmail.com',
            rating: 5,
            comment: 'অসাধারণ কোয়ালিটি! মধুর সুবাস ও ঘন গন্ধই প্রমাণ করে এটা শতভাগ খাঁটি সুন্দরবনের মধু। প্যাকেজিংও খুব ভালো ছিল।',
            verifiedPurchase: true,
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            productId: honey._id,
            userName: 'Shirin Akter',
            userEmail: 'shirin@yahoo.com',
            rating: 5,
            comment: 'আমি আগেও অনেক দোকান থেকে কিনেছি কিন্তু ঘরে বাজারের মধুর স্বাদ অনন্য। ধন্যবাদ ঘরে বাজার!',
            verifiedPurchase: true,
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            productId: honey._id,
            userName: 'Mahmudul Karim',
            userEmail: 'karim@gmail.com',
            rating: 4,
            comment: 'মধু অনেক ভালো, তবে ডেলিভারি ১ দিন লেট হয়েছিল। তবুও পণ্যের মানে কোনো আপস নেই।',
            verifiedPurchase: true,
        },
    ]);
    console.log('✅ Seeded Product Reviews');
    // 6. Seed Sample Orders with BDT and Bangladeshi logistics
    await Order_1.OrderModel.create([
        {
            tenantId: tenantAmaderBazar.tenantId,
            orderNumber: 'GB-2026-901',
            customerEmail: 'customer@gmail.com',
            status: 'CONFIRMED',
            totalAmount: 2000,
            currency: 'BDT',
            paymentMethod: 'BKASH',
            paymentStatus: 'PAID',
            idempotencyKey: 'seed_gb_001',
            shippingAddress: {
                fullName: 'Rahim Ahmed',
                phone: '+8801711223344',
                addressLine1: 'House 42, Road 11, Sector 4',
                city: 'Uttara, Dhaka',
                postalCode: '1230',
                country: 'BD',
            },
            items: [
                {
                    variantSku: 'GB-HNY-1KG',
                    title: 'Sundarban Raw Natural Honey (1 kg)',
                    quantity: 1,
                    unitPrice: 1050,
                    totalPrice: 1050,
                },
                {
                    variantSku: 'GB-GHEE-500G',
                    title: 'Premium Organic Cow Ghee (500 gm)',
                    quantity: 1,
                    unitPrice: 950,
                    totalPrice: 950,
                },
            ],
        },
        {
            tenantId: tenantAmaderBazar.tenantId,
            orderNumber: 'GB-2026-902',
            customerEmail: 'customer@gmail.com',
            status: 'SHIPPED',
            totalAmount: 1450,
            currency: 'BDT',
            paymentMethod: 'COD',
            paymentStatus: 'UNPAID',
            idempotencyKey: 'seed_gb_002',
            trackingNumber: 'STDF_8849201',
            courierName: 'STEADFAST',
            shippingAddress: {
                fullName: 'Rahim Ahmed',
                phone: '+8801711223344',
                addressLine1: 'Flat B3, Green Valley, Dhanmondi 27',
                city: 'Dhaka',
                postalCode: '1209',
                country: 'BD',
            },
            items: [
                {
                    variantSku: 'GB-OIL-5L',
                    title: 'Wood Pressed Pure Mustard Oil (5 Liter)',
                    quantity: 1,
                    unitPrice: 1450,
                    totalPrice: 1450,
                },
            ],
        },
    ]);
    console.log('✅ Seeded Sample Ghorebazar Orders with bKash and COD');
    console.log('✨ Ghorebazar Database Seeding Completed!');
    await mongoose_1.default.disconnect();
}
seedDatabase().catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
});
