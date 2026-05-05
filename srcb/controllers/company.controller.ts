import { Request, Response } from 'express';
import { body, param } from 'express-validator';
import { Company, User } from '../models';
import { asyncHandler, NotFoundError, ConflictError } from '../middleware/errors';
import { auditAction } from '../middleware/audit';
import { AuditAction, EntityType, UserRole } from '../types';
import { Types } from 'mongoose';

// Validation rules
export const createCompanyValidation = [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('cnpj')
        .optional({ checkFalsy: true })
        .trim()
        .customSanitizer(value => value ? value.replace(/\D/g, '') : value)
        .matches(/^\d{14}$/).withMessage('CNPJ must be 14 digits'),
    body('sectors').optional().isArray().withMessage('Sectors must be an array'),
    body('sectors.*.name').optional().isString().trim().withMessage('Each sector must have a name'),
    body('sectors.*.managerId').optional().isMongoId().withMessage('Manager ID must be a valid Mongo ID'),
    body('contractDuration').optional().isInt({ min: 1 }).withMessage('Duration must be positive integer'),
    body('modality').optional().isString().trim(),
];

export const updateCompanyValidation = [
    param('id').isMongoId().withMessage('Invalid company ID'),
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('cnpj')
        .optional({ checkFalsy: true })
        .trim()
        .customSanitizer(value => value ? value.replace(/\D/g, '') : value)
        .matches(/^\d{14}$/).withMessage('CNPJ must be 14 digits'),
    body('sectors').optional().isArray().withMessage('Sectors must be an array'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('contractDuration').optional().isInt({ min: 1 }),
    body('modality').optional().isString().trim(),
];

/**
 * List companies for current user
 * GET /api/companies
 */
export const listCompanies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, roles, companyAccess } = req.user!;
    const isAdmin = roles.includes(UserRole.MASTER) || roles.includes(UserRole.MASTER);

    let query = {};

    // Non-admin users only see their allowed companies
    if (!isAdmin) {
        const companyIds = (companyAccess || []).map(access => access.companyId);
        query = {
            _id: { $in: companyIds },
            isActive: true,
        };
    }

    const companies = await Company.find(query).sort({ name: 1 });

    res.json({
        success: true,
        data: companies,
    });
});

/**
 * Get single company
 * GET /api/companies/:id
 */
export const getCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { roles, companyAccess } = req.user!;
    const isAdmin = roles.includes(UserRole.MASTER);

    if (!Types.ObjectId.isValid(id as string)) {
        throw new NotFoundError('Company');
    }

    // Check access
    const hasAccess = (companyAccess || []).some(a => a.companyId.toString() === id);
    if (!isAdmin && !hasAccess) {
        throw new NotFoundError('Company');
    }

    const company = await Company.findById(id);

    if (!company) {
        throw new NotFoundError('Company');
    }

    res.json({
        success: true,
        data: company,
    });
});

/**
 * Create new company (admin only)
 * POST /api/companies
 */
export const createCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, sectors, cnpj, address, contractDuration, modality } = req.body;

    // Check for duplicate name
    const existing = await Company.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
        throw new ConflictError('Company with this name already exists');
    }

    // Check for duplicate CNPJ if provided
    if (cnpj) {
        const existingCnpj = await Company.findOne({ cnpj });
        if (existingCnpj) {
            throw new ConflictError('Company with this CNPJ already exists');
        }
    }

    const company = await Company.create({
        name,
        cnpj,
        address,
        contractDuration: contractDuration || 12,
        modality: modality || 'Padrão',
        sectors: sectors || [],
    });

    // Add creator to company access as ADMIN
    if (req.user) {
        await User.findByIdAndUpdate(req.user.userId, {
            $push: {
                companyAccess: {
                    companyId: company._id,
                    role: UserRole.MASTER
                }
            }
        });
    }

    // Audit log
    await auditAction(
        req,
        AuditAction.CREATE,
        EntityType.COMPANY,
        company._id.toString(),
        null,
        company.toObject() as any
    );

    res.status(201).json({
        success: true,
        data: company,
    });
});

/**
 * Update company
 * PUT /api/companies/:id
 */
export const updateCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, sectors, isActive, cnpj, address, contractDuration, modality } = req.body;

    const company = await Company.findById(id);
    if (!company) {
        throw new NotFoundError('Company');
    }

    const before = company.toObject();

    // Check for duplicate name if changing
    if (name && name !== company.name) {
        const existing = await Company.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            _id: { $ne: id },
        });
        if (existing) {
            throw new ConflictError('Company with this name already exists');
        }
        company.name = name;
    }

    // Check for duplicate CNPJ if changing
    if (cnpj && cnpj !== company.cnpj) {
        const existingCnpj = await Company.findOne({
            cnpj,
            _id: { $ne: id },
        });
        if (existingCnpj) {
            throw new ConflictError('Company with this CNPJ already exists');
        }
        company.cnpj = cnpj;
    }

    if (sectors !== undefined) company.sectors = sectors;
    if (isActive !== undefined) company.isActive = isActive;
    if (address !== undefined) company.address = address;
    if (contractDuration !== undefined) company.contractDuration = contractDuration;
    if (modality !== undefined) company.modality = modality;

    await company.save();

    // Audit log
    await auditAction(
        req,
        AuditAction.UPDATE,
        EntityType.COMPANY,
        company._id.toString(),
        before as any,
        company.toObject() as any
    );

    res.json({
        success: true,
        data: company,
    });
});

/**
 * Delete (soft) company
 * DELETE /api/companies/:id
 */
export const deleteCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
        throw new NotFoundError('Company');
    }

    const before = company.toObject();

    // Soft delete - set inactive
    company.isActive = false;
    await company.save();

    // Remove from all users' allowed companies
    await User.updateMany(
        { 'companyAccess.companyId': id },
        {
            $pull: { companyAccess: { companyId: id } },
            // If activeCompanyId was this company, we should probably set it to null
            // This logic is tricky with one update command if we only want to unset it if it matches
            // We can do it in a separate command or assume the user will be forced to switch next login
        }
    );

    // Unset activeCompanyId if it matches the deleted company
    await User.updateMany(
        { activeCompanyId: id },
        { $set: { activeCompanyId: null } }
    );

    // Audit log
    await auditAction(
        req,
        AuditAction.DELETE,
        EntityType.COMPANY,
        company._id.toString(),
        before as any,
        { ...company.toObject(), isActive: false } as any
    );

    res.json({
        success: true,
        message: 'Company deleted successfully',
    });
});

/**
 * Add sector to company
 * POST /api/companies/:id/sectors
 */
export const addSector = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { sector, managerId } = req.body;

    if (!sector || typeof sector !== 'string' || sector.trim().length === 0) {
        throw new Error('Sector name is required');
    }

    const company = await Company.findById(id);
    if (!company) {
        throw new NotFoundError('Company');
    }

    const normalizedSector = sector.trim();

    // Check if sector already exists (case-insensitive)
    const exists = company.sectors.some(
        s => s.name.toLowerCase() === normalizedSector.toLowerCase()
    );

    if (exists) {
        throw new ConflictError('Sector already exists');
    }

    const before = company.toObject();

    company.sectors.push({ name: normalizedSector, managerId: managerId || null });
    await company.save();

    // Audit log
    await auditAction(
        req,
        AuditAction.UPDATE,
        EntityType.COMPANY,
        company._id.toString(),
        before as any,
        company.toObject() as any
    );

    res.status(201).json({
        success: true,
        data: company,
        message: `Sector "${normalizedSector}" added successfully`,
    });
});

/**
 * Update sector
 * PUT /api/companies/:id/sectors/:sectorId
 */
export const updateSector = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, sectorId } = req.params;
    const { name, managerId } = req.body;

    const company = await Company.findById(id);
    if (!company) {
        throw new NotFoundError('Company');
    }

    const sectorIndex = company.sectors.findIndex(s => (s as any)._id?.toString() === sectorId);
    if (sectorIndex === -1) {
        throw new NotFoundError('Sector');
    }

    // Check data integrity
    if (name) {
        const normalizedName = name.trim();
        // Check for duplicate name if changing
        const exists = company.sectors.some(
            (s, idx) => idx !== sectorIndex && s.name.toLowerCase() === normalizedName.toLowerCase()
        );
        if (exists) {
            throw new ConflictError('Sector name already exists');
        }
        company.sectors[sectorIndex].name = normalizedName;
    }

    if (managerId !== undefined) {
        company.sectors[sectorIndex].managerId = managerId || null;
    }

    await company.save();

    res.json({
        success: true,
        message: 'Sector updated successfully',
        data: company
    });
});

/**
 * Remove sector
 * DELETE /api/companies/:id/sectors/:sectorId
 */
export const deleteSector = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, sectorId } = req.params;

    const company = await Company.findById(id);
    if (!company) {
        throw new NotFoundError('Company');
    }

    const sectorIndex = company.sectors.findIndex(s => (s as any)._id?.toString() === sectorId);
    if (sectorIndex === -1) {
        throw new NotFoundError('Sector');
    }

    // Optional: Check if sector has dependencies (processes, users) before deleting?
    // For now, strict deletion is risky if data exists.
    // Ideally we should block if users or processes are linked.
    // Proceeding with deletion as per request, but a warning would be good in frontend.

    company.sectors.splice(sectorIndex, 1);
    await company.save();

    res.json({
        success: true,
        message: 'Sector removed successfully',
        data: company
    });
});

