import { Router } from 'express';
import { validate, authenticate, authorize, requireCompany } from '../middleware';
import {
    getActiveConfig,
    createConfig,
    createConfigValidation,
    getConfigHistory,
    simulateScore,
    simulateScoreValidation,
} from '../controllers';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate, requireCompany);

// Get active config
router.get('/active', getActiveConfig);

// Get version history
router.get('/history', getConfigHistory);

// Simulate score calculation
router.post('/simulate', validate(simulateScoreValidation), simulateScore);

// Create new config version (manager+)
router.post(
    '/',
    authorize(UserRole.MASTER, UserRole.MANAGER),
    validate(createConfigValidation),
    createConfig
);

export default router;

