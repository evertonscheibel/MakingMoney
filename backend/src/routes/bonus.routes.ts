import { Router } from 'express';
import { validate, authenticate, requireCompany } from '../middleware';
import { calculateBonusPreview, bonusValidation, getBonusReport, reportValidation } from '../controllers/bonus.controller';

const router = Router();

router.use(authenticate, requireCompany);

// Legacy preview endpoint
router.get('/preview', validate(bonusValidation), calculateBonusPreview);

// New report endpoint with stepped bonus calculation
router.get('/report', validate(reportValidation), getBonusReport);

export default router;
