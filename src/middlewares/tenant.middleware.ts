import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { TenantModel, ITenant } from '../models/Tenant';

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      tenant?: ITenant;
    }
  }
}

/**
 * Hybrid Multi-Tenant Extraction Middleware:
 * 1. Standalone Mode: Always uses DEFAULT_TENANT_ID from environment.
 * 2. SaaS Mode: Extracts tenant via:
 *    - Explicit Header 'x-tenant-id' or 'x-tenant-slug'
 *    - Host Subdomain (e.g. fashion.platform.local -> 'fashion')
 *    - Custom domain mapping (e.g. brand.com)
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Standalone Mode Check
    if (config.tenantMode === 'STANDALONE') {
      req.tenantId = config.defaultTenantId;
      return next();
    }

    // 2. Direct Header Override (Storefront / Admin API proxy)
    const headerTenantId = req.headers['x-tenant-id'] as string;
    const headerTenantSlug = req.headers['x-tenant-slug'] as string;

    if (headerTenantId) {
      req.tenantId = headerTenantId;
      return next();
    }

    if (headerTenantSlug) {
      const tenant = await TenantModel.findOne({ slug: headerTenantSlug });
      if (tenant) {
        req.tenantId = tenant.tenantId;
        req.tenant = tenant;
        return next();
      }
    }

    // 3. Subdomain / Custom Domain Resolution from Host
    const host = req.headers.host || '';
    const rootDomain = config.rootDomain; // e.g., 'platform.local' or 'platform.com'

    if (host.includes(rootDomain)) {
      const subdomain = host.split(`.${rootDomain}`)[0].split(':')[0]; // strip port
      if (subdomain && subdomain !== 'api' && subdomain !== 'admin' && subdomain !== 'www') {
        const tenant = await TenantModel.findOne({ slug: subdomain });
        if (tenant) {
          req.tenantId = tenant.tenantId;
          req.tenant = tenant;
          return next();
        }
      }
    } else if (host) {
      // Custom Domain Lookup
      const domainWithoutPort = host.split(':')[0];
      const tenant = await TenantModel.findOne({ domain: domainWithoutPort });
      if (tenant) {
        req.tenantId = tenant.tenantId;
        req.tenant = tenant;
        return next();
      }
    }

    // 4. Default fallback for development/testing
    req.tenantId = config.defaultTenantId;
    next();
  } catch (error) {
    next(error);
  }
}
