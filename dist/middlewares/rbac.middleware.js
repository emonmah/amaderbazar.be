"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.Permission = void 0;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
var Permission;
(function (Permission) {
    Permission["MANAGE_TENANTS"] = "manage:tenants";
    Permission["VIEW_METRICS"] = "view:metrics";
    Permission["CREATE_PRODUCT"] = "create:product";
    Permission["UPDATE_PRODUCT"] = "update:product";
    Permission["DELETE_PRODUCT"] = "delete:product";
    Permission["VIEW_CATALOG"] = "view:catalog";
    Permission["VIEW_INVENTORY"] = "view:inventory";
    Permission["MANAGE_INVENTORY"] = "manage:inventory";
    Permission["RECEIVE_BATCH"] = "receive:batch";
    Permission["VIEW_ORDERS"] = "view:orders";
    Permission["UPDATE_ORDER_STATUS"] = "update:order_status";
    Permission["CANCEL_ORDER"] = "cancel:order";
    Permission["DISPATCH_ORDER"] = "dispatch:order";
    Permission["GENERATE_INVOICE"] = "generate:invoice";
    Permission["VIEW_PAYMENTS"] = "view:payments";
    Permission["ISSUE_REFUND"] = "issue:refund";
    Permission["VIEW_CUSTOMERS"] = "view:customers";
})(Permission || (exports.Permission = Permission = {}));
exports.ROLE_PERMISSIONS = {
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
function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
function requirePermission(...requiredPermissions) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const rolePerms = exports.ROLE_PERMISSIONS[req.user.role] || [];
        const customPerms = req.user.permissions || [];
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
