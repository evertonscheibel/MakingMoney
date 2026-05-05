import { Router } from 'express';
import { validate } from '../middleware/errors';
import { authenticate, authorize, requireCompanyAccess } from '../middleware/auth';
import {
    listCompanies,
    getCompany,
    createCompany,
    createCompanyValidation,
    updateCompany,
    updateCompanyValidation,
    deleteCompany,
    addSector,
    updateSector,
    deleteSector,
} from '../controllers/company.controller';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

// List companies (all authenticated users)
router.get('/', listCompanies);

// Get single company
router.get('/:id', getCompany);

// Admin only routes
router.post(
    '/',
    authorize(UserRole.MASTER),
    validate(createCompanyValidation),
    createCompany
);

router.put(
    '/:id',
    authorize(UserRole.MASTER, UserRole.MANAGER),
    validate(updateCompanyValidation),
    updateCompany
);

router.delete(
    '/:id',
    authorize(UserRole.MASTER),
    deleteCompany
);

// Add sector to company
router.post(
    '/:id/sectors',
    authorize(UserRole.MASTER, UserRole.MANAGER),
    addSector
);

// Update/Delete sector
router.put(
    '/:id/sectors/:sectorId',
    authorize(UserRole.MASTER, UserRole.MANAGER),
    updateSector
);

router.delete(
    '/:id/sectors/:sectorId',
    authorize(UserRole.MASTER),
    deleteSector
);

export default router;

