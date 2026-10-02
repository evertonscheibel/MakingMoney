import { Router } from 'express';
import { authenticate, requireCompany, authorize } from '../middleware';
import { UserRole } from '../types';
import { listEmailLogs, resendEmail } from '../controllers/emailLog.controller';

const router = Router();

router.use(authenticate, requireCompany, authorize(UserRole.MASTER));

// List email logs (all users can access)
router.get('/', listEmailLogs);

// Resend failed email (admins/managers only handled in controller)
router.post('/:id/resend', resendEmail);

export default router;

