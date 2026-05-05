import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

export const requireCompany = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let companyId = req.headers['x-company-id'] as string;

        // Fallback to user's active company if header is missing
        if (!companyId && req.user?.activeCompanyId) {
            companyId = req.user.activeCompanyId;
        }

        if (!companyId) {
            return res.status(403).json({
                success: false,
                error: 'Company context required (x-company-id header missing)'
            });
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        // Verify access
        // companyAccess structure: [{ companyId: ObjectId, role: string }]
        const hasAccess = (req.user.companyAccess || []).some(
            access => access.companyId.toString() === companyId
        );

        if (!hasAccess) {
            // Check for System Admin/Master bypass if applicable?? 
            // For now, strict enforcement.
            // But maybe MASTER role has global access? 
            // Let's stick to explicit companyAccess for now to be safe, 
            // or perform a check for UserRole.MASTER in req.user.roles
            const isMaster = req.user.roles.includes('master' as any); // Type assertion if needed
            if (!isMaster) {
                return res.status(403).json({
                    success: false,
                    error: 'User does not have access to this company'
                });
            }
        }

        // Set company context
        req.companyId = companyId;

        // Also set active role for this company context?
        // const access = req.user.companyAccess.find(a => a.companyId.toString() === companyId);
        // req.user.activeCompanyRole = access?.role; 

        next();
    } catch (error) {
        console.error('Tenant middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error processing company context'
        });
    }
};

