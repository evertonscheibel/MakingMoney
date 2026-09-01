import { Request, Response } from 'express';
import { User, Company } from '../models';
import { asyncHandler, NotFoundError } from '../middleware/errors';
import { UserRole } from '../types';
import { body } from 'express-validator';
import { getEffectiveSectors } from '../utils';

/**
 * List all users that have access to the current active company
 * GET /api/users
 */
// Validation rules
export const updateUserValidation = [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('roles').optional().isArray().withMessage('Roles must be an array'),
    body('allowedMenus').optional().isArray().withMessage('Allowed Menus must be an array'),
    body('allowedCompanyIds').optional().isArray().withMessage('Company IDs must be an array'),
    body('isActive').optional().isBoolean(),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

/**
 * List users
 * GET /api/users
 */
export const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roles } = req.user!;
    const activeCompanyId = req.companyId!;

    let query: any = {};

    // If not master, restrict to active company's allowed users
    // Note: This logic might need review if we want to see users across companies in some cases
    if (!roles.includes(UserRole.MASTER)) {
        if (!activeCompanyId) {
            res.json({ success: true, data: [] });
            return;
        }
        // Filter users who have access to the active company
        query = { 'companyAccess.companyId': activeCompanyId };
    }

    const users = await User.find(query)
        .select('name email roles allowedMenus companyAccess activeCompanyId isEmailVerified sector sectors baseSalary createdAt')
        .sort({ name: 1 });

    // Map companyAccess to allowedCompanyIds for frontend compatibility
    const usersWithAllowedIds = users.map(user => {
        const userObj = user.toObject();
        return {
            ...userObj,
            allowedCompanyIds: (user.companyAccess || [])
                .map(a => a.companyId?.toString())
                .filter(Boolean)
        };
    });

    res.json({
        success: true,
        data: usersWithAllowedIds
    });
});

/**
 * Update user
 * PUT /api/users/:id
 */
export const updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { roles, allowedMenus, allowedCompanyIds, name, sector, sectors, baseSalary, password } = req.body;
    const currentUser = req.user!;
    // Company context this edit is happening in — sector permissions submitted
    // in this request are scoped to THIS company only (see getEffectiveSectors).
    const editingCompanyId = req.companyId;

    // Authorization check
    const isMaster = currentUser.roles.includes(UserRole.MASTER);
    const isAdmin = currentUser.roles.includes(UserRole.MASTER);

    if (!isMaster && !isAdmin) {
        throw new NotFoundError('User'); // Hide via 404
    }

    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
        throw new NotFoundError('User');
    }

    if (name) userToUpdate.name = name;
    if (sector !== undefined) userToUpdate.sector = sector;
    if (baseSalary !== undefined) userToUpdate.baseSalary = baseSalary;
    if (roles) {
        userToUpdate.roles = roles.filter((role: any) => Object.values(UserRole).includes(role));
    }
    if (allowedMenus) userToUpdate.allowedMenus = allowedMenus;

    // Update password if provided (MASTER only check is already done above)
    if (password) {
        userToUpdate.passwordHash = password;
    }

    // Map allowedCompanyIds to companyAccess, PRESERVING each existing entry's
    // role/sectors for companies that remain — a full overwrite here used to
    // silently wipe out per-company sector permissions on every save.
    if (allowedCompanyIds) {
        const primaryRole = (roles && roles.length > 0) ? roles[0] : UserRole.OPERATOR;
        const existingByCompany = new Map(
            (userToUpdate.companyAccess || []).map((a: any) => [a.companyId.toString(), a])
        );

        userToUpdate.companyAccess = allowedCompanyIds.map((companyId: string) => {
            const existing: any = existingByCompany.get(companyId);
            return {
                companyId,
                role: primaryRole,
                sectors: existing?.sectors || [],
            };
        }) as any;
    }

    // Sector permissions submitted here apply only to `editingCompanyId` —
    // never to every company this user can access.
    if (sectors !== undefined && editingCompanyId) {
        (userToUpdate as any).sectors = sectors; // legacy fallback for un-migrated reads
        const entry: any = (userToUpdate.companyAccess || []).find(
            (a: any) => a.companyId.toString() === editingCompanyId
        );
        if (entry) {
            entry.sectors = sectors;
            userToUpdate.markModified('companyAccess');
        }
    }

    await userToUpdate.save();

    // Return with allowedCompanyIds for frontend compatibility
    const userObj = userToUpdate.toObject();
    const responseData = {
        ...userObj,
        allowedCompanyIds: (userToUpdate.companyAccess || [])
            .map(a => a.companyId?.toString())
            .filter(Boolean)
    };

    res.json({
        success: true,
        data: responseData
    });
});

/**
 * Delete user (soft delete not implemented in model, so simplified hard delete or just check logic)
 * DELETE /api/users/:id
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const currentUser = req.user!;

    if (!currentUser.roles.includes(UserRole.MASTER)) {
        throw new NotFoundError('User');
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
        throw new NotFoundError('User');
    }

    res.json({
        success: true,
        message: 'User deleted successfully'
    });
});


/**
 * Sector permission audit — flags users whose effective sector permissions
 * for a company they can access don't match ANY real sector name in that
 * company. This is exactly the failure mode that made processes appear to
 * "disappear": a user's sector list (e.g. "Contabilidade/Fiscal", valid for
 * one company) silently stops matching after a sector rename or when it was
 * never valid for a different company sharing that user.
 *
 * GET /api/users/sector-audit
 */
export const sectorAudit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const currentUser = req.user!;
    if (!currentUser.roles.includes(UserRole.MASTER)) {
        throw new NotFoundError('User');
    }

    const [users, companies] = await Promise.all([
        User.find({}).select('name email roles companyAccess sectors sector'),
        Company.find({}).select('name sectors'),
    ]);
    const companiesById = new Map(companies.map((c) => [c._id.toString(), c]));

    const issues: Array<{
        userId: string;
        userName: string;
        userEmail: string;
        companyId: string;
        companyName: string;
        effectiveSectors: string[];
        companySectors: string[];
    }> = [];

    for (const user of users) {
        if (user.roles.includes(UserRole.MASTER)) continue; // MASTER bypasses sector restriction entirely

        for (const access of user.companyAccess || []) {
            const company = companiesById.get(access.companyId.toString());
            if (!company) continue; // dangling reference to a deleted company — different issue

            const companyRole = access.role;
            if (companyRole === UserRole.MASTER) continue;

            const effectiveSectors = getEffectiveSectors(
                {
                    companyAccess: (user.companyAccess || []).map((a: any) => ({
                        companyId: a.companyId.toString(),
                        role: a.role,
                        sectors: a.sectors || [],
                    })),
                    sectors: (user as any).sectors,
                    sector: user.sector,
                },
                access.companyId.toString()
            );

            if (effectiveSectors.length === 0) continue; // no sectors claimed at all — not this bug class

            const companySectorNames = company.sectors.map((s) => s.name);
            const hasAnyMatch = effectiveSectors.some((s) => companySectorNames.includes(s));

            if (!hasAnyMatch) {
                issues.push({
                    userId: user._id.toString(),
                    userName: user.name,
                    userEmail: user.email,
                    companyId: company._id.toString(),
                    companyName: company.name,
                    effectiveSectors,
                    companySectors: companySectorNames,
                });
            }
        }
    }

    res.json({ success: true, data: issues });
});
