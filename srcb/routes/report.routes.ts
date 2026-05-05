import { Router } from 'express';
import { validate, authenticate, requireCompany } from '../middleware';
import {
    getSummary,
    getSectorRanking,
    getStatusDistribution,
    getExtract,
    getHistory,
    getProcessCurve,
    reportValidation,
} from '../controllers';

const router = Router();

router.use(authenticate, requireCompany);

// Summary KPIs
router.get('/summary', validate(reportValidation), getSummary);

// Sector ranking
router.get('/sector-ranking', validate(reportValidation), getSectorRanking);

// Status distribution (pie chart)
router.get('/status-distribution', validate(reportValidation), getStatusDistribution);

// Detailed extract
router.get('/extract', validate(reportValidation), getExtract);

// History trend (last 5 months)
router.get('/history', getHistory);

// Process curve (Planned vs Realized)
router.get('/process-curve', validate(reportValidation), getProcessCurve);

export default router;

