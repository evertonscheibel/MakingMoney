import { Router } from 'express';
import { validate, authenticate, requireCompany } from '../middleware';
import { getMyMetrics, getTeamMetrics, getMetricsValidation } from '../controllers/metrics.controller';

const router = Router();

router.get('/me', authenticate, requireCompany, validate(getMetricsValidation), getMyMetrics);
router.get('/team', authenticate, requireCompany, validate(getMetricsValidation), getTeamMetrics);

export default router;

