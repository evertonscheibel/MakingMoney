import { Router } from 'express';
import { validate } from '../middleware/errors';
import { authenticate, authorize } from '../middleware/auth';
import { requireCompany } from '../middleware/tenant';
import {
    listCycles,
    listCyclesValidation,
    getCurrentCycle,
    getCycle,
    openCycle,
    openCycleValidation,
    closeCycle,
    previewCloseCycle,
    resetCycle,
    restoreCycle,
    checkRestorePoint,
    reopenCycle, // Added
} from '../controllers/cycle.controller';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate, requireCompany);

// List cycles
router.get('/', validate(listCyclesValidation), listCycles);

// Get current open cycle
router.get('/current', getCurrentCycle);

// Open new cycle (manager+)
router.post(
    '/open',
    authorize(UserRole.MASTER, UserRole.MANAGER, UserRole.MASTER),
    validate(openCycleValidation),
    openCycle
);

// Preview close cycle
router.get(
    '/preview-close',
    authorize(UserRole.MASTER, UserRole.MANAGER, UserRole.MASTER),
    previewCloseCycle
);

// Get cycle by ID
router.get('/:id', getCycle);

// Check restore point
router.get('/:id/restore-point', authorize(UserRole.MASTER, UserRole.MANAGER, UserRole.MASTER), checkRestorePoint);

// Close current cycle (manager+)
router.post(
    '/close',
    authorize(UserRole.MASTER, UserRole.MANAGER, UserRole.MASTER),
    closeCycle
);

// Reset cycle (manager+)
router.post(
    '/:id/reset',
    authorize(UserRole.MASTER, UserRole.MANAGER, UserRole.MASTER),
    resetCycle
);

// Restore cycle (manager+)
router.post(
    '/:id/restore',
    authorize(UserRole.MASTER, UserRole.MANAGER, UserRole.MASTER),
    restoreCycle
);

// Reopen cycle (manager+)
router.post(
    '/:id/reopen',
    authorize(UserRole.MASTER, UserRole.MANAGER, UserRole.MASTER),
    reopenCycle
);

export default router;

