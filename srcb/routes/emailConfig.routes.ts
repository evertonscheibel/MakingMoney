import { Router } from 'express';
import { validate, authenticate, authorize, requireCompanyAccess } from '../middleware';
import {
    getEmailConfig,
    updateEmailConfig,
    testEmailConnection,
    emailConfigValidation,
} from '../controllers/emailConfig.controller';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate, requireCompanyAccess);

// Only Admin and Master can manage email settings
router.use(authorize(UserRole.MASTER, UserRole.MASTER));

router.get('/', getEmailConfig);
router.put('/', validate(emailConfigValidation), updateEmailConfig);
router.post('/test', testEmailConnection);

export default router;

