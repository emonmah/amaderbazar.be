"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const User_1 = require("../../models/User");
const config_1 = require("../../config");
const logger_1 = require("../../observability/logger");
function generateAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.accessSecret, {
        expiresIn: config_1.config.jwt.accessExpiresIn,
    });
}
function generateRefreshToken() {
    return crypto_1.default.randomBytes(40).toString('hex');
}
class AuthController {
    async register(req, res) {
        try {
            const { email, password, name, role } = req.body;
            const tenantId = req.tenantId;
            if (!email || !password || !name) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            const existing = await User_1.UserModel.findOne({ tenantId, email: email.toLowerCase() });
            if (existing) {
                return res.status(409).json({ error: 'User already exists with this email' });
            }
            const passwordHash = await bcryptjs_1.default.hash(password, 10);
            const assignedRole = role || 'CUSTOMER';
            const user = await User_1.UserModel.create({
                tenantId,
                email: email.toLowerCase(),
                passwordHash,
                name,
                role: assignedRole,
            });
            logger_1.logger.info({ userId: user._id, tenantId, role: assignedRole }, 'User registered successfully');
            res.status(201).json({
                message: 'User registered successfully',
                user: { id: user._id, email: user.email, name: user.name, role: user.role },
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Registration error');
            res.status(500).json({ error: 'Failed to register user', message: error.message });
        }
    }
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const tenantId = req.tenantId;
            const user = await User_1.UserModel.findOne({ tenantId, email: email.toLowerCase() });
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            // Generate Access Token (15m)
            const tokenPayload = {
                userId: user._id.toString(),
                tenantId: user.tenantId,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
            };
            const accessToken = generateAccessToken(tokenPayload);
            // Generate Refresh Token with Rotation
            const rawRefreshToken = generateRefreshToken();
            const tokenHash = crypto_1.default.createHash('sha256').update(rawRefreshToken).digest('hex');
            const expiresAt = new Date(Date.now() + config_1.config.jwt.refreshExpiresIn * 1000);
            user.refreshTokens.push({
                tokenHash,
                expiresAt,
                createdAt: new Date(),
            });
            await user.save();
            // Set httpOnly cookie for refresh token
            res.cookie('refreshToken', rawRefreshToken, {
                httpOnly: true,
                secure: config_1.config.isProduction,
                sameSite: 'strict',
                maxAge: config_1.config.jwt.refreshExpiresIn * 1000,
            });
            res.json({
                message: 'Authentication successful',
                accessToken,
                expiresIn: config_1.config.jwt.accessExpiresIn,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    permissions: user.permissions,
                    tenantId: user.tenantId,
                },
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Login error');
            res.status(500).json({ error: 'Login failed', message: error.message });
        }
    }
    async refreshToken(req, res) {
        try {
            const rawRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
            if (!rawRefreshToken) {
                return res.status(401).json({ error: 'Missing refresh token' });
            }
            const tokenHash = crypto_1.default.createHash('sha256').update(rawRefreshToken).digest('hex');
            const user = await User_1.UserModel.findOne({ 'refreshTokens.tokenHash': tokenHash });
            if (!user) {
                return res.status(401).json({ error: 'Invalid or expired refresh token' });
            }
            const tokenRecord = user.refreshTokens.find((r) => r.tokenHash === tokenHash);
            if (!tokenRecord || (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date())) {
                return res.status(401).json({ error: 'Refresh token expired' });
            }
            // Token Rotation: Invalidate current refresh token and generate new one
            const newRawRefreshToken = generateRefreshToken();
            const newTokenHash = crypto_1.default.createHash('sha256').update(newRawRefreshToken).digest('hex');
            const newExpiresAt = new Date(Date.now() + config_1.config.jwt.refreshExpiresIn * 1000);
            tokenRecord.revokedAt = new Date();
            tokenRecord.replacedByToken = newTokenHash;
            user.refreshTokens.push({
                tokenHash: newTokenHash,
                expiresAt: newExpiresAt,
                createdAt: new Date(),
            });
            // Cleanup old revoked tokens (keep last 10)
            if (user.refreshTokens.length > 10) {
                user.refreshTokens = user.refreshTokens.slice(-10);
            }
            await user.save();
            const newAccessToken = generateAccessToken({
                userId: user._id.toString(),
                tenantId: user.tenantId,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
            });
            res.cookie('refreshToken', newRawRefreshToken, {
                httpOnly: true,
                secure: config_1.config.isProduction,
                sameSite: 'strict',
                maxAge: config_1.config.jwt.refreshExpiresIn * 1000,
            });
            res.json({
                accessToken: newAccessToken,
                expiresIn: config_1.config.jwt.accessExpiresIn,
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Refresh token rotation error');
            res.status(500).json({ error: 'Failed to rotate refresh token' });
        }
    }
    async logout(req, res) {
        try {
            const rawRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
            if (rawRefreshToken) {
                const tokenHash = crypto_1.default.createHash('sha256').update(rawRefreshToken).digest('hex');
                await User_1.UserModel.updateOne({ 'refreshTokens.tokenHash': tokenHash }, { $set: { 'refreshTokens.$.revokedAt': new Date() } });
            }
            res.clearCookie('refreshToken');
            res.json({ message: 'Logged out successfully' });
        }
        catch (error) {
            res.status(500).json({ error: 'Logout failed' });
        }
    }
    async getMe(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: 'Unauthorized' });
            const user = await User_1.UserModel.findById(req.user.userId).select('-passwordHash -refreshTokens');
            if (!user)
                return res.status(404).json({ error: 'User not found' });
            res.json({ user });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch user' });
        }
    }
    async oauthLogin(req, res) {
        try {
            const tenantId = req.tenantId;
            const { provider = 'google', email, name, avatar, oauthId } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email is required for OAuth login' });
            }
            let user = await User_1.UserModel.findOne({ tenantId, email: email.toLowerCase() });
            if (!user) {
                // Create new user with random password hash
                const dummyPassword = crypto_1.default.randomBytes(16).toString('hex');
                const passwordHash = await bcryptjs_1.default.hash(dummyPassword, 10);
                user = await User_1.UserModel.create({
                    tenantId,
                    email: email.toLowerCase(),
                    passwordHash,
                    name: name || (provider === 'google' ? 'Google User' : 'Facebook User'),
                    role: 'CUSTOMER',
                });
                logger_1.logger.info({ userId: user._id, tenantId, provider }, 'New user registered via OAuth');
            }
            // Generate Access Token (15m)
            const tokenPayload = {
                userId: user._id.toString(),
                tenantId: user.tenantId,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
            };
            const accessToken = generateAccessToken(tokenPayload);
            // Generate Refresh Token with Rotation
            const rawRefreshToken = generateRefreshToken();
            const tokenHash = crypto_1.default.createHash('sha256').update(rawRefreshToken).digest('hex');
            const expiresAt = new Date(Date.now() + config_1.config.jwt.refreshExpiresIn * 1000);
            user.refreshTokens.push({
                tokenHash,
                expiresAt,
                createdAt: new Date(),
            });
            await user.save();
            res.cookie('refreshToken', rawRefreshToken, {
                httpOnly: true,
                secure: config_1.config.isProduction,
                sameSite: 'strict',
                maxAge: config_1.config.jwt.refreshExpiresIn * 1000,
            });
            res.json({
                message: `Successfully authenticated via ${provider}`,
                accessToken,
                expiresIn: config_1.config.jwt.accessExpiresIn,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    permissions: user.permissions,
                    tenantId: user.tenantId,
                    avatar: avatar || (provider === 'google' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'),
                },
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'OAuth login error');
            res.status(500).json({ error: 'OAuth authentication failed', message: error.message });
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
