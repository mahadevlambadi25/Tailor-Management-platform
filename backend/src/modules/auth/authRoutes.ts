import { Router } from 'express';
import { AuthController } from './authController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { rateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Google OAuth Endpoints
router.get('/google', rateLimiter(60000, 30), AuthController.googleRedirect);
router.get('/google/callback', AuthController.googleCallback);
router.post('/google', rateLimiter(60000, 20), AuthController.googleTokenLogin);

// Public Registration Endpoint
router.post('/register', rateLimiter(60000, 10), AuthController.staffRegister);

router.use(tenantContext);

router.post('/login', rateLimiter(60000, 15), AuthController.staffLogin);
router.get('/me', authGuard, AuthController.getMe);
router.post('/customer/request-otp', rateLimiter(60000, 5), AuthController.requestCustomerOtp);
router.post('/customer/verify-otp', rateLimiter(60000, 10), AuthController.verifyCustomerOtp);

export default router;
