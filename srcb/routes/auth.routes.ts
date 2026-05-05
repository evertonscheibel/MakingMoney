import { Router } from 'express';
import { validate } from '../middleware/errors';
import {
    login,
    loginValidation,
    register,
    registerValidation,
    me,
    switchCompany,
    verifyEmail,
    forgotPassword,
    resetPassword,
    resendVerificationCode,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// Public routes
router.post('/login', validate(loginValidation), login);
router.post('/register', validate(registerValidation), register);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.use(authenticate);

router.get('/me', me);
router.put('/switch-company/:id', switchCompany);

// Register (Admin only for specific roles/companies - legacy or internal use)
// router.post(
//     '/register-admin',
//     authorize(UserRole.MASTER, UserRole.MASTER),
//     validate(registerValidation),
//     register
// );

export default router;

