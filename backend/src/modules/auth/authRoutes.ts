import { Router } from 'express';
import { AuthController } from './authController';
import { UsersController } from '../users/usersController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { rateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Google OAuth Endpoints
router.get('/google', rateLimiter(60000, 30), AuthController.googleRedirect);
router.get('/google/callback', AuthController.googleCallback);
router.post('/google', rateLimiter(60000, 20), AuthController.googleTokenLogin);

// Public Registration & Authentication Endpoints
router.post('/register', rateLimiter(60000, 10), AuthController.staffRegister);
router.post('/login', rateLimiter(60000, 15), AuthController.staffLogin);

// Authenticated Profile & Credential Endpoints
router.get('/me', authGuard, tenantContext, AuthController.getMe);
router.post('/change-password', authGuard, tenantContext, UsersController.changeOwnPassword);

// Customer Portal OTP Endpoints
router.post('/customer/request-otp', rateLimiter(60000, 5), tenantContext, AuthController.requestCustomerOtp);
router.post('/customer/verify-otp', rateLimiter(60000, 10), tenantContext, AuthController.verifyCustomerOtp);

export default router;

