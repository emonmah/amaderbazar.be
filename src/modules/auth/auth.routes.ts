import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/register', authRateLimiter, (req, res) => authController.register(req, res));
router.post('/login', authRateLimiter, (req, res) => authController.login(req, res));
router.post('/oauth', (req, res) => authController.oauthLogin(req, res));
router.post('/oauth/google', (req, res) => authController.oauthLogin(req, res));
router.post('/oauth/facebook', (req, res) => authController.oauthLogin(req, res));
router.post('/refresh-token', (req, res) => authController.refreshToken(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/me', authenticate, (req, res) => authController.getMe(req, res));

export const authRoutes = router;
