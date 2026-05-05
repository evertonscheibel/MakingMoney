import { Router } from 'express';
import { validate, authenticate, requireCompanyAccess } from '../middleware';
import {
    simulateEmail,
    simulateEmailValidation,
    listEmailEvents,
} from '../controllers';

const router = Router();

router.use(authenticate, requireCompanyAccess);

// Simulate receiving an email
router.post('/simulate', validate(simulateEmailValidation), simulateEmail);

// List email events
router.get('/', listEmailEvents);

export default router;

