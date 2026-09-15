"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid Authorization header',
        });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.accessSecret);
        // Verify tenant boundary: user token must match tenant of the request
        if (req.tenantId && decoded.tenantId !== req.tenantId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Tenant mismatch: Access denied to foreign tenant resources',
            });
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'TokenExpired',
                message: 'Access token expired. Please rotate using refresh token.',
            });
        }
        return res.status(401).json({
            error: 'InvalidToken',
            message: 'Authentication token is invalid',
        });
    }
}
function optionalAuthenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.accessSecret);
        if (!req.tenantId || decoded.tenantId === req.tenantId) {
            req.user = decoded;
        }
    }
    catch (error) {
        // Ignore invalid/expired token in optional mode
    }
    next();
}
