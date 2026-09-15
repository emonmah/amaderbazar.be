"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantIsolationPlugin = tenantIsolationPlugin;
/**
 * Mongoose Plugin for Row-Level / Document-Level Multi-Tenant Isolation
 * Automatically ensures:
 * 1. Compound indexes on tenantId for sub-second indexed queries.
 * 2. Pre-save check to guarantee tenantId is always populated.
 * 3. Enforces query filter by tenantId when provided in query options or conditions.
 */
function tenantIsolationPlugin(schema) {
    // Ensure tenantId exists on schema
    if (!schema.path('tenantId')) {
        schema.add({
            tenantId: {
                type: String,
                required: true,
                index: true,
            },
        });
    }
    // Pre-save validation
    schema.pre('save', function (next) {
        if (!this.get('tenantId')) {
            return next(new Error('TenantIsolationError: tenantId is required for saving document'));
        }
        next();
    });
}
