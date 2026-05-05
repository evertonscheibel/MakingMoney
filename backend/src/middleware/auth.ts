import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, logger } from '../config';
import { User } from '../models';
import { AuthenticatedUser, UserRole } from '../types';

interface JWTPayload {
    userId: string;
    email: string;
    roles: UserRole[];
    iat: number;
    exp: number;
}

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.',
            });
            return;
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

        // Get user from database to ensure they still exist and get latest data
        const user = await User.findById(decoded.userId).select('+passwordHash');

        if (!user) {
            res.status(401).json({
                success: false,
                error: 'User not found.',
            });
            return;
        }

        // Attach user info to request
        try {
            req.user = {
                userId: user._id.toString(),
                email: user.email,
                roles: user.roles,
                activeCompanyId: user.activeCompanyId?.toString() || null,
                companyAccess: (user.companyAccess || [])
                    .filter(a => a && a.companyId)
                    .map(a => ({
                        companyId: a.companyId.toString(),
                        role: a.role
                    })),
                sector: user.sector,
                sectors: (user as any).sectors || [],
            };
            next();
        } catch (mapError) {
            console.error('[DEBUG] Error mapping user data in authenticate:', mapError);
            throw mapError;
        }
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                error: 'Token expired.',
            });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                error: 'Invalid token.',
            });
            return;
        }

        logger.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed.',
        });
    }
}

/**
 * Authorization middleware - checks for specific roles
 */
export function authorize(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Not authenticated.',
            });
            return;
        }

        const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

        if (!hasRole) {
            res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.',
            });
            return;
        }

        next();
    };
}

/**
 * Check if user has access to company
 */
export function requireCompanyAccess(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: 'Not authenticated.',
        });
        return;
    }

    // Admin and Master have access to all companies
    if (req.user.roles.includes(UserRole.MASTER) || req.user.roles.includes(UserRole.MASTER)) {
        next();
        return;
    }

    // Check if user has an active company set
    if (!req.user.activeCompanyId) {
        res.status(400).json({
            success: false,
            error: 'No active company selected.',
        });
        return;
    }

    // Check if the active company is in user's allowed list
    const hasAccess = (req.user.companyAccess || []).some(
        a => a.companyId === req.user!.activeCompanyId
    );

    if (!hasAccess) {
        res.status(403).json({
            success: false,
            error: 'Access denied to this company.',
        });
        return;
    }

    next();
}

/**
 * Generate JWT token
 */
export function generateToken(user: {
    _id: string;
    email: string;
    roles: UserRole[];
    sector?: string;
}): string {
    const payload = {
        userId: user._id.toString(),
        email: user.email,
        roles: user.roles,
        sector: user.sector,
    };

    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as any,
    });
}

