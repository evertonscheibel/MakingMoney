import { Request, Response } from 'express';
import { User } from '../models';
import { asyncHandler, NotFoundError } from '../middleware/errors';
import { UserRole } from '../types';
import { body } from 'express-validator';

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
        .select('name email roles allowedMenus companyAccess activeCompanyId isEmailVerified sector sectors createdAt')
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
    const { roles, allowedMenus, allowedCompanyIds, name, sector, sectors, password } = req.body;
    const currentUser = req.user!;

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
    if (sectors !== undefined) (userToUpdate as any).sectors = sectors;
    if (roles) {
        userToUpdate.roles = roles.filter((role: any) => Object.values(UserRole).includes(role));
    }
    if (allowedMenus) userToUpdate.allowedMenus = allowedMenus;

    // Update password if provided (MASTER only check is already done above)
    if (password) {
        userToUpdate.passwordHash = password;
    }

    // Map allowedCompanyIds to companyAccess
    if (allowedCompanyIds) {
        // Use the primary role selected by the user, or default to OPERATOR/current role
        const primaryRole = (roles && roles.length > 0) ? roles[0] : UserRole.OPERATOR;

        userToUpdate.companyAccess = allowedCompanyIds.map((companyId: string) => ({
            companyId: companyId,
            role: primaryRole // Assign global role to each company
        }));
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

