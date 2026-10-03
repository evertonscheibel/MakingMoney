import { Router } from 'express';
import { authenticate, authorize, requireCompany } from '../middleware';
import { listEmailTemplates, upsertEmailTemplate } from '../controllers/emailTemplate.controller';
import { UserRole } from '../types';
const router = Router();
router.use(authenticate, requireCompany, authorize(UserRole.MASTER));
router.get('/', listEmailTemplates);
router.put('/:category', (req, _res, next) => { req.body.category = req.params.category; next(); }, upsertEmailTemplate);
export default router;
