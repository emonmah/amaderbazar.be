import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserModel, UserRole } from '../../models/User';
import { config } from '../../config';
import { logger } from '../../observability/logger';

function generateAccessToken(payload: any): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, role } = req.body;
      const tenantId = req.tenantId;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existing = await UserModel.findOne({ tenantId, email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ error: 'User already exists with this email' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const assignedRole: UserRole = role || 'CUSTOMER';

      const user = await UserModel.create({
        tenantId,
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: assignedRole,
      });

      logger.info({ userId: user._id, tenantId, role: assignedRole }, 'User registered successfully');

      res.status(201).json({
        message: 'User registered successfully',
        user: { id: user._id, email: user.email, name: user.name, role: user.role },
      });
    } catch (error: any) {
      logger.error({ error }, 'Registration error');
      res.status(500).json({ error: 'Failed to register user', message: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const tenantId = req.tenantId;

      const user = await UserModel.findOne({ tenantId, email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
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
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresIn * 1000);

      user.refreshTokens.push({
        tokenHash,
        expiresAt,
        createdAt: new Date(),
      });
      await user.save();

      // Set httpOnly cookie for refresh token
      res.cookie('refreshToken', rawRefreshToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: config.jwt.refreshExpiresIn * 1000,
      });

      res.json({
        message: 'Authentication successful',
        accessToken,
        expiresIn: config.jwt.accessExpiresIn,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          tenantId: user.tenantId,
        },
      });
    } catch (error: any) {
      logger.error({ error }, 'Login error');
      res.status(500).json({ error: 'Login failed', message: error.message });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const rawRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
      if (!rawRefreshToken) {
        return res.status(401).json({ error: 'Missing refresh token' });
      }

      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      const user = await UserModel.findOne({ 'refreshTokens.tokenHash': tokenHash });

      if (!user) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const tokenRecord = user.refreshTokens.find((r) => r.tokenHash === tokenHash);
      if (!tokenRecord || (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date())) {
        return res.status(401).json({ error: 'Refresh token expired' });
      }

      // Token Rotation: Invalidate current refresh token and generate new one
      const newRawRefreshToken = generateRefreshToken();
      const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');
      const newExpiresAt = new Date(Date.now() + config.jwt.refreshExpiresIn * 1000);

      tokenRecord.revokedAt = new Date();
      tokenRecord.replacedByToken = newTokenHash;

      user.refreshTokens.push({
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        createdAt: new Date(),
      });

      // Cleanup old revoked tokens (keep last 10)
      if (user.refreshTokens.length > 10) {
        user.refreshTokens = user.refreshTokens.slice(-10) as any;
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
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: config.jwt.refreshExpiresIn * 1000,
      });

      res.json({
        accessToken: newAccessToken,
        expiresIn: config.jwt.accessExpiresIn,
      });
    } catch (error: any) {
      logger.error({ error }, 'Refresh token rotation error');
      res.status(500).json({ error: 'Failed to rotate refresh token' });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const rawRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
      if (rawRefreshToken) {
        const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
        await UserModel.updateOne(
          { 'refreshTokens.tokenHash': tokenHash },
          { $set: { 'refreshTokens.$.revokedAt': new Date() } }
        );
      }

      res.clearCookie('refreshToken');
      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async getMe(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const user = await UserModel.findById(req.user.userId).select('-passwordHash -refreshTokens');
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  async oauthLogin(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId;
      const { provider = 'google', email, name, avatar, oauthId } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required for OAuth login' });
      }

      let user = await UserModel.findOne({ tenantId, email: email.toLowerCase() });

      if (!user) {
        // Create new user with random password hash
        const dummyPassword = crypto.randomBytes(16).toString('hex');
        const passwordHash = await bcrypt.hash(dummyPassword, 10);

        user = await UserModel.create({
          tenantId,
          email: email.toLowerCase(),
          passwordHash,
          name: name || (provider === 'google' ? 'Google User' : 'Facebook User'),
          role: 'CUSTOMER',
        });
        logger.info({ userId: user._id, tenantId, provider }, 'New user registered via OAuth');
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
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresIn * 1000);

      user.refreshTokens.push({
        tokenHash,
        expiresAt,
        createdAt: new Date(),
      });
      await user.save();

      res.cookie('refreshToken', rawRefreshToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: config.jwt.refreshExpiresIn * 1000,
      });

      res.json({
        message: `Successfully authenticated via ${provider}`,
        accessToken,
        expiresIn: config.jwt.accessExpiresIn,
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
    } catch (error: any) {
      logger.error({ error }, 'OAuth login error');
      res.status(500).json({ error: 'OAuth authentication failed', message: error.message });
    }
  }
}

export const authController = new AuthController();
