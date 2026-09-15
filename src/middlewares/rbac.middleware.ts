import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

export enum Permission {
  MANAGE_TENANTS = 'manage:tenants',
  VIEW_METRICS = 'view:metrics',
  CREATE_PRODUCT = 'create:product',
  UPDATE_PRODUCT = 'update:product',
  DELETE_PRODUCT = 'delete:product',
  VIEW_CATALOG = 'view:catalog',
  VIEW_INVENTORY = 'view:inventory',
  MANAGE_INVENTORY = 'manage:inventory',
  RECEIVE_BATCH = 'receive:batch',
  VIEW_ORDERS = 'view:orders',
  UPDATE_ORDER_STATUS = 'update:order_status',
  CANCEL_ORDER = 'cancel:order',
  DISPATCH_ORDER = 'dispatch:order',
  GENERATE_INVOICE = 'generate:invoice',
  VIEW_PAYMENTS = 'view:payments',
  ISSUE_REFUND = 'issue:refund',
  VIEW_CUSTOMERS = 'view:customers',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),
  STORE_OWNER: [
    Permission.VIEW_METRICS,
    Permission.CREATE_PRODUCT,
    Permission.UPDATE_PRODUCT,
    Permission.DELETE_PRODUCT,
    Permission.VIEW_CATALOG,
    Permission.VIEW_INVENTORY,
    Permission.MANAGE_INVENTORY,
    Permission.RECEIVE_BATCH,
    Permission.VIEW_ORDERS,
    Permission.UPDATE_ORDER_STATUS,
    Permission.CANCEL_ORDER,
    Permission.DISPATCH_ORDER,
    Permission.GENERATE_INVOICE,
    Permission.VIEW_PAYMENTS,
    Permission.ISSUE_REFUND,
    Permission.VIEW_CUSTOMERS,
  ],
  WAREHOUSE_MANAGER: [
    Permission.VIEW_CATALOG,
    Permission.VIEW_INVENTORY,
    Permission.MANAGE_INVENTORY,
    Permission.RECEIVE_BATCH,
    Permission.VIEW_ORDERS,
    Permission.UPDATE_ORDER_STATUS,
    Permission.DISPATCH_ORDER,
    Permission.GENERATE_INVOICE,
  ],
  SUPPORT_REP: [
    Permission.VIEW_CATALOG,
    Permission.VIEW_ORDERS,
    Permission.VIEW_PAYMENTS,
    Permission.ISSUE_REFUND,
    Permission.VIEW_CUSTOMERS,
    Permission.GENERATE_INVOICE,
  ],
  CUSTOMER: [
    Permission.VIEW_CATALOG,
  ],
};

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role ${req.user.role} does not have access to this resource`,
      });
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rolePerms = ROLE_PERMISSIONS[req.user.role] || [];
    const customPerms = (req.user.permissions as Permission[]) || [];
    const allPerms = new Set([...rolePerms, ...customPerms]);

    const hasAll = requiredPermissions.every((perm) => allPerms.has(perm));
    if (!hasAll) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing required permissions: ${requiredPermissions.join(', ')}`,
      });
    }

    next();
  };
}
