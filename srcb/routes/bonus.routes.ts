import { Router } from 'express';
import { validate, authenticate, requireCompanyAccess } from '../middleware';
import { calculateBonusPreview, bonusValidation } from '../controllers/bonus.controller';

const router = Router();

router.use(authenticate, requireCompanyAccess);

router.get('/preview', validate(bonusValidation), calculateBonusPreview);

export default router;

