import { Request, Response } from 'express';
import { ProductModel } from '../../models/Product';
import { SliderModel } from '../../models/Slider';
import { ReviewModel } from '../../models/Review';
import { CategoryModel } from '../../models/Category';
import { redis } from '../../config/redis';
import { logger } from '../../observability/logger';
import axios from 'axios';

export class CatalogController {
  /**
   * Get product catalog with Redis Multi-Level Caching
   * Supports filtering by category, search, and hotDeals
   */
  async getProducts(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { category, search, hotDeals, page = '1', limit = '50' } = req.query;

      const cacheKey = `catalog:${tenantId}:cat_${category || 'all'}:q_${search || 'all'}:hd_${hotDeals || 'all'}:p_${page}:l_${limit}`;

      // Check Redis Cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      // MongoDB query with tenant isolation
      const query: any = { tenantId, isPublished: true };
      if (category && category !== 'All') query.category = category;
      if (hotDeals === 'true') query.isHotDeal = true;
      if (search) query.title = { $regex: search as string, $options: 'i' };

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [products, total] = await Promise.all([
        ProductModel.find(query).sort({ isHotDeal: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        ProductModel.countDocuments(query),
      ]);

      const responsePayload = {
        products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      };

      // Cache hot catalog in Redis with 10-minute TTL
      await redis.set(cacheKey, JSON.stringify(responsePayload), 'EX', 600);

      res.setHeader('X-Cache', 'MISS');
      res.json(responsePayload);
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch catalog products');
      res.status(500).json({ error: 'Failed to fetch catalog' });
    }
  }

  async getProductBySlug(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { slug } = req.params;

      const cacheKey = `product:${tenantId}:${slug}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      const product = await ProductModel.findOne({ tenantId, slug, isPublished: true }).lean();
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      await redis.set(cacheKey, JSON.stringify(product), 'EX', 1800);
      res.setHeader('X-Cache', 'MISS');
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  }

  async createProduct(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const {
        title,
        slug,
        description,
        category,
        basePrice,
        compareAtPrice,
        discountPercent,
        isHotDeal,
        unit,
        variants,
        images,
        attributes,
      } = req.body;

      const autoSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Calculate discount percent if compareAtPrice is higher than basePrice
      let calculatedDiscount = discountPercent || 0;
      if (compareAtPrice && compareAtPrice > basePrice && !discountPercent) {
        calculatedDiscount = Math.round(((compareAtPrice - basePrice) / compareAtPrice) * 100);
      }

      const product = await ProductModel.create({
        tenantId,
        title,
        slug: autoSlug,
        description,
        category,
        basePrice,
        compareAtPrice,
        discountPercent: calculatedDiscount,
        isHotDeal: Boolean(isHotDeal),
        unit: unit || '1 pc',
        variants: variants || [
          {
            sku: `${autoSlug.toUpperCase()}-DEF`,
            price: basePrice,
            compareAtPrice,
            batches: [{ batchNumber: `BATCH-${Date.now()}`, quantity: 50, reservedQuantity: 0, lowStockThreshold: 10 }],
          },
        ],
        images: images || [],
        attributes: attributes || {},
        rating: 5,
        numReviews: 0,
      });

      // Invalidation Hook: Evict Redis catalog cache for tenant
      await this.invalidateCatalogCache(tenantId, autoSlug);

      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create product', message: error.message });
    }
  }

  async updateProduct(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const product = await ProductModel.findOneAndUpdate(
        { tenantId, _id: id },
        { $set: req.body },
        { new: true }
      );

      if (!product) return res.status(404).json({ error: 'Product not found' });

      // Invalidation Hook
      await this.invalidateCatalogCache(tenantId, product.slug);

      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  }

  /**
   * Quick toggle Hot Deal for Admin
   */
  async toggleHotDeal(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const product = await ProductModel.findOne({ tenantId, _id: id });
      if (!product) return res.status(404).json({ error: 'Product not found' });

      product.isHotDeal = !product.isHotDeal;
      await product.save();

      await this.invalidateCatalogCache(tenantId, product.slug);

      res.json({
        message: `Product hot deal set to ${product.isHotDeal}`,
        product,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to toggle hot deal' });
    }
  }

  /**
   * Quick update discount for Admin
   */
  async updateDiscount(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;
      const { basePrice, compareAtPrice, discountPercent } = req.body;

      const product = await ProductModel.findOne({ tenantId, _id: id });
      if (!product) return res.status(404).json({ error: 'Product not found' });

      if (basePrice !== undefined) product.basePrice = Number(basePrice);
      if (compareAtPrice !== undefined) product.compareAtPrice = Number(compareAtPrice);

      if (discountPercent !== undefined) {
        product.discountPercent = Number(discountPercent);
      } else if (product.compareAtPrice && product.compareAtPrice > product.basePrice) {
        product.discountPercent = Math.round(
          ((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100
        );
      }

      await product.save();
      await this.invalidateCatalogCache(tenantId, product.slug);

      res.json({
        message: 'Product pricing and discount updated successfully',
        product,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update discount' });
    }
  }

  // ==========================================
  // Slider / Banner Endpoints
  // ==========================================
  async getSliders(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { all } = req.query;

      const query: any = { tenantId };
      if (all !== 'true') {
        query.isActive = true;
      }

      const sliders = await SliderModel.find(query).sort({ displayOrder: 1, createdAt: -1 }).lean();
      res.json(sliders);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch sliders' });
    }
  }

  async createSlider(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { title, subtitle, badge, imageUrl, linkUrl, buttonText, displayOrder, isActive } = req.body;

      if (!title || !imageUrl) {
        return res.status(400).json({ error: 'title and imageUrl are required' });
      }

      const slider = await SliderModel.create({
        tenantId,
        title,
        subtitle: subtitle || '',
        badge: badge || '',
        imageUrl,
        linkUrl: linkUrl || '/',
        buttonText: buttonText || 'Shop Now',
        displayOrder: displayOrder !== undefined ? displayOrder : 0,
        isActive: isActive !== undefined ? isActive : true,
      });

      res.status(201).json(slider);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create slider', message: error.message });
    }
  }

  async updateSlider(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const slider = await SliderModel.findOneAndUpdate(
        { tenantId, _id: id },
        { $set: req.body },
        { new: true }
      );

      if (!slider) return res.status(404).json({ error: 'Slider not found' });
      res.json(slider);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update slider' });
    }
  }

  async deleteSlider(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const slider = await SliderModel.findOneAndDelete({ tenantId, _id: id });
      if (!slider) return res.status(404).json({ error: 'Slider not found' });

      res.json({ message: 'Slider deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete slider' });
    }
  }

  // ==========================================
  // Product Reviews Endpoints
  // ==========================================
  async getProductReviews(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params; // Product ID or slug

      let productId = id;
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        const product = await ProductModel.findOne({ tenantId, slug: id });
        if (product) productId = product._id.toString();
      }

      const reviews = await ReviewModel.find({ tenantId, productId })
        .sort({ createdAt: -1 })
        .lean();

      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch reviews' });
    }
  }

  async createProductReview(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params; // Product ID or slug
      const { userName, userEmail, rating, comment } = req.body;

      if (!rating || !comment || !userName) {
        return res.status(400).json({ error: 'rating, comment, and userName are required' });
      }

      let product = await ProductModel.findOne({
        tenantId,
        $or: [{ _id: /^[0-9a-fA-F]{24}$/.test(id) ? id : null }, { slug: id }],
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const review = await ReviewModel.create({
        tenantId,
        productId: product._id,
        userId: (req as any).user?.userId,
        userName,
        userEmail: userEmail || (req as any).user?.email || 'customer@gmail.com',
        rating: Math.min(5, Math.max(1, Number(rating))),
        comment,
        verifiedPurchase: true,
      });

      // Recalculate average rating
      const allReviews = await ReviewModel.find({ tenantId, productId: product._id });
      const totalScore = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = Number((totalScore / allReviews.length).toFixed(1));

      product.rating = avgRating;
      product.numReviews = allReviews.length;
      await product.save();

      await this.invalidateCatalogCache(tenantId, product.slug);

      res.status(201).json({
        message: 'Review submitted successfully',
        review,
        productRating: avgRating,
        numReviews: product.numReviews,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to submit review', message: error.message });
    }
  }

  /**
   * Category Management (Storefront & Admin)
   */
  async getCategories(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const includeInactive = req.query.all === 'true';

      const cacheKey = `catalog:${tenantId}:categories:${includeInactive ? 'all' : 'active'}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      const query: any = { tenantId };
      if (!includeInactive) {
        query.isActive = true;
      }

      let categories = await CategoryModel.find(query).sort({ displayOrder: 1, createdAt: 1 }).lean();

      // Auto-seed default categories if empty for this tenant
      if (categories.length === 0 && !includeInactive) {
        const count = await CategoryModel.countDocuments({ tenantId });
        if (count === 0) {
          logger.info({ tenantId }, 'Auto-seeding default categories for tenant');
          const defaultCategories = [
            { name: 'মধু ও ঘি', slug: 'honey-and-ghee', icon: '🍯', description: 'সুন্দরবনের খাঁটি মধু ও সুগন্ধি গাওয়া ঘি', displayOrder: 1 },
            { name: 'তেল ও বীজ', slug: 'oil-and-seeds', icon: '🫒', description: 'ঘানি ভাঙা সরিষা ও কালোজিরা তেল', displayOrder: 2 },
            { name: 'ড্রাই ফ্রুটস ও বাদাম', slug: 'dry-fruits-nuts', icon: '🥜', description: 'মেডজুল খেজুর ও কাজু-পেস্তা বাদাম', displayOrder: 3 },
            { name: 'মসলা ও ডাল', slug: 'spices-and-pulses', icon: '🌾', description: 'খাঁটি মসলা ও প্রিমিয়াম বাসমতি চাল', displayOrder: 4 },
            { name: 'অর্গানিক স্বাস্থ্য', slug: 'organic-health', icon: '🌿', description: 'চিয়া সিড ও ভেষজ সম্পূরক', displayOrder: 5 },
          ];
          await CategoryModel.insertMany(
            defaultCategories.map((cat) => ({
              ...cat,
              tenantId,
              isActive: true,
            }))
          );
          categories = await CategoryModel.find(query).sort({ displayOrder: 1, createdAt: 1 }).lean();
        }
      }

      await redis.set(cacheKey, JSON.stringify(categories), 'EX', 600);
      res.setHeader('X-Cache', 'MISS');
      res.json(categories);
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch categories');
      res.status(500).json({ error: 'Failed to fetch categories', message: error.message });
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { name, slug, icon, imageUrl, description, displayOrder, isActive } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      const generatedSlug = (slug || name)
        .toLowerCase()
        .trim()
        .replace(/[^a-zA-Z0-9\u0980-\u09FF\s-]/g, '')
        .replace(/\s+/g, '-');

      const existing = await CategoryModel.findOne({
        tenantId,
        $or: [{ slug: generatedSlug }, { name: name.trim() }],
      });

      if (existing) {
        return res.status(400).json({ error: 'এই নামের বা স্লাগের ক্যাটাগরি ইতিমধ্যে বিদ্যমান রয়েছে (Category already exists)' });
      }

      const category = await CategoryModel.create({
        tenantId,
        name: name.trim(),
        slug: generatedSlug,
        icon: icon || '🌿',
        imageUrl: imageUrl || '',
        description: description || '',
        displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
        isActive: isActive !== false,
      });

      await this.invalidateCategoryCache(tenantId);

      res.status(201).json(category);
    } catch (error: any) {
      logger.error({ error }, 'Failed to create category');
      res.status(500).json({ error: 'Failed to create category', message: error.message });
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;
      const { name, slug, icon, imageUrl, description, displayOrder, isActive } = req.body;

      const category = await CategoryModel.findOne({ _id: id, tenantId });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      if (name) category.name = name.trim();
      if (slug) category.slug = slug.toLowerCase().trim().replace(/\s+/g, '-');
      if (icon !== undefined) category.icon = icon;
      if (imageUrl !== undefined) category.imageUrl = imageUrl;
      if (description !== undefined) category.description = description;
      if (typeof displayOrder === 'number') category.displayOrder = displayOrder;
      if (isActive !== undefined) category.isActive = isActive;

      await category.save();
      await this.invalidateCategoryCache(tenantId);

      res.json(category);
    } catch (error: any) {
      logger.error({ error }, 'Failed to update category');
      res.status(500).json({ error: 'Failed to update category', message: error.message });
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const category = await CategoryModel.findOneAndDelete({ _id: id, tenantId });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      await this.invalidateCategoryCache(tenantId);

      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error: any) {
      logger.error({ error }, 'Failed to delete category');
      res.status(500).json({ error: 'Failed to delete category', message: error.message });
    }
  }

  private async invalidateCategoryCache(tenantId: string) {
    try {
      const keys = await redis.keys(`catalog:${tenantId}:categories:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.warn({ err }, 'Error during category cache invalidation');
    }
  }

  private async invalidateCatalogCache(tenantId: string, slug?: string) {
    try {
      const keys = await redis.keys(`catalog:${tenantId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      if (slug) {
        await redis.del(`product:${tenantId}:${slug}`);
      }
      logger.info({ tenantId, evictedKeysCount: keys.length }, 'Evicted Redis hot catalog cache');

      // Trigger Next.js On-Demand ISR Revalidation if configured
      const storefrontUrl = process.env.STOREFRONT_URL || 'http://localhost:3000';
      if (slug) {
        axios.post(`${storefrontUrl}/api/revalidate`, { tag: slug, secret: 'isr_revalidate_secret' }).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err }, 'Error during cache invalidation');
    }
  }
}

export const catalogController = new CatalogController();
