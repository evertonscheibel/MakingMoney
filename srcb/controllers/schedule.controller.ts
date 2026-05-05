import { Request, Response } from 'express';
import { query } from 'express-validator';
import { Process } from '../models';
import { asyncHandler } from '../middleware/errors';
import { Types } from 'mongoose';
import { UserRole } from '../types';

export const getScheduleValidation = [
    query('period').matches(/^\d{4}-\d{2}$/).withMessage('Period must be in YYYY-MM format'),
];

/**
 * Get company schedule for a specific period
 * GET /api/schedule
 */
export const getSchedule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles: globalRoles, sector: legacySector, sectors: userSectors, userId, companyAccess } = req.user!;
    const activeCompanyId = req.companyId;
    const { period, sector } = req.query;

    if (!activeCompanyId) {
        res.status(400).json({ success: false, message: 'No active company selected' });
        return;
    }

    // Determine role for THIS specific company
    const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === activeCompanyId);
    const companyRole = currentCompanyAccess?.role as UserRole || UserRole.OPERATOR;
    const isAdminOrMaster = globalRoles.includes(UserRole.MASTER) || companyRole === UserRole.MASTER;

    // Get all allowed sectors for this user
    const company = await (await import('../models')).Company.findById(activeCompanyId);
    const managedSectors = company?.sectors
        .filter(s => s.managerId && s.managerId.toString() === userId)
        .map(s => s.name) || [];

    const combinedSectors = [...new Set([...(userSectors || []), ...(legacySector ? [legacySector] : []), ...managedSectors])];

    // Enforce sector restriction
    if (!isAdminOrMaster) {
        if (combinedSectors.length === 0) {
            // No access to any sector
            res.json({ success: true, data: [] });
            return;
        }

        if (sector) {
            if (!combinedSectors.includes(sector as string)) {
                // User trying to access a sector they don't have
                res.status(403).json({ success: false, message: 'Access to requested sector is denied' });
                return;
            }
        }
    }

    const [year, month] = (period as string).split('-').map(Number);
    // Month in Date is 0-indexed
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const filter: any = {
        companyId: new Types.ObjectId(activeCompanyId),
        plannedDate: {
            $gte: startOfMonth,
            $lte: endOfMonth,
        },
    };

    if (sector) {
        filter.sector = sector;
    } else if (!isAdminOrMaster) {
        // If no specific sector requested but user is restricted, show all their sectors
        filter.sector = { $in: combinedSectors };
    }

    const processes = await Process.find(filter)
        .select('code title sector plannedDate limitDate deliveryDate status responsibleUserId')
        .sort({ plannedDate: 1, sector: 1 })
        .populate('responsibleUserId', 'name')
        .lean();

    res.json({
        success: true,
        data: processes,
    });
});

