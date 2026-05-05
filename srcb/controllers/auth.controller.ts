import { Request, Response } from 'express';
import { body } from 'express-validator';
import { User, Company } from '../models';
import { generateToken } from '../middleware/auth';
import { asyncHandler, NotFoundError, ConflictError, UnauthorizedError } from '../middleware/errors';
import { UserRole } from '../types';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../utils/mailer';

// Validation rules
export const loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const registerValidation = [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('position').optional().trim(),
    body('department').optional().trim(),
    body('sector').optional().trim(),
    body('roles').optional().isArray().withMessage('Roles must be an array'),
    body('allowedCompanyIds').optional().isArray().withMessage('Company IDs must be an array'),
];

/**
 * Login user
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // Compare password
    const isValid = await user.comparePassword(password);

    if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // Generate token
    const token = generateToken({
        _id: user._id.toString(),
        email: user.email,
        roles: user.roles,
        sector: user.sector,
    });

    // Get active company details if any
    let activeCompany = null;
    if (user.activeCompanyId) {
        const company = await Company.findById(user.activeCompanyId);
        if (company) {
            activeCompany = {
                id: company._id,
                name: company.name,
                sectors: company.sectors,
            };
        }
    }

    res.json({
        success: true,
        data: {
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                activeCompanyId: user.activeCompanyId,
                activeCompany,
                allowedCompanyIds: (user.companyAccess || [])
                    .filter(a => a && a.companyId)
                    .map(a => a.companyId.toString()),
                allowedMenus: user.allowedMenus,
            },
        },
    });
});

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, email, password, position, department, sector, roles, allowedCompanyIds } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ConflictError('User with this email already exists');
    }

    // Generate 6-digit numeric verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.create({
        name,
        email,
        passwordHash: password, // Will be hashed by pre-save hook
        position,
        department,
        sector,
        roles: roles || [UserRole.OPERATOR],
        companyAccess: allowedCompanyIds?.map((cid: string) => ({
            companyId: cid,
            role: roles?.[0] || UserRole.OPERATOR
        })) || [],
        isEmailVerified: false,
        emailVerificationToken: verificationCode,
        emailVerificationExpires: verificationExpires,
    });

    // Send verification email
    const companyId = allowedCompanyIds?.[0] || null;
    await sendVerificationEmail(user.email, verificationCode, user.name, companyId);

    res.status(201).json({
        success: true,
        data: {
            id: user._id,
            name: user.name,
            email: user.email,
            roles: user.roles,
        },
        message: 'Registro realizado com sucesso. Verifique seu e-mail para ativar sua conta.',
    });
});

/**
 * Forgot password
 * POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        // We don't want to reveal if a user exists
        res.json({
            success: true,
            message: 'Se este e-mail estiver cadastrado, você receberá um link de recuperação.',
        });
        return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    const companyId = user.activeCompanyId?.toString() || user.companyAccess?.[0]?.companyId?.toString();
    await sendPasswordResetEmail(user.email, resetToken, user.name, companyId);

    res.json({
        success: true,
        message: 'Se este e-mail estiver cadastrado, você receberá um link de recuperação.',
    });
});

/**
 * Reset password
 * POST /api/auth/reset-password/:token
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    const { password } = req.body;

    const resetTokenHash = crypto
        .createHash('sha256')
        .update(token as string)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
        throw new UnauthorizedError('Link de recuperação inválido ou expirado');
    }

    user.passwordHash = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({
        success: true,
        message: 'Senha alterada com sucesso. Você já pode fazer login.',
    });
});

/**
 * Verify email code
 * POST /api/auth/verify-email
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, code } = req.body;

    if (!email || !code) {
        throw new UnauthorizedError('Email and verification code are required');
    }

    const user = await User.findOne({
        email,
        emailVerificationToken: code,
        emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
        throw new UnauthorizedError('Código inválido ou expirado');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    const companyId = user.activeCompanyId?.toString() || user.companyAccess?.[0]?.companyId?.toString();
    await sendWelcomeEmail(user.email, user.name, companyId);

    res.json({
        success: true,
        message: 'E-mail verificado com sucesso. Você já pode fazer login.',
    });
});

/**
 * Resend verification code
 * POST /api/auth/resend-verification
 */
export const resendVerificationCode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    if (!email) {
        throw new UnauthorizedError('Email is required');
    }

    const user = await User.findOne({ email, isEmailVerified: false });

    if (!user) {
        // We return success even if not found to avoid email enumeration
        res.json({
            success: true,
            message: 'Se este e-mail for válido e não estiver verificado, você receberá um novo código.',
        });
        return;
    }

    // Generate new 6-digit numeric verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.emailVerificationToken = verificationCode;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    const companyId = user.activeCompanyId?.toString() || user.companyAccess?.[0]?.companyId?.toString();
    await sendVerificationEmail(user.email, verificationCode, user.name, companyId);

    res.json({
        success: true,
        message: 'Novo código enviado com sucesso.',
    });
});

/**
 * Get current user info
 * GET /api/auth/me
 */
export const me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.user!.userId);

    if (!user) {
        throw new NotFoundError('User');
    }

    // Get company details if active
    let activeCompany = null;
    if (user.activeCompanyId) {
        activeCompany = await Company.findById(user.activeCompanyId);
    }

    res.json({
        success: true,
        data: {
            id: user._id,
            name: user.name,
            email: user.email,
            roles: user.roles,
            position: user.position,
            department: user.department,
            sector: user.sector,
            activeCompanyId: user.activeCompanyId,
            activeCompany: activeCompany ? {
                id: activeCompany._id,
                name: activeCompany.name,
                sectors: activeCompany.sectors,
            } : null,
            allowedCompanyIds: (user.companyAccess || [])
                .filter(a => a && a.companyId)
                .map(a => a.companyId.toString()),
            allowedMenus: user.allowedMenus,
        },
    });
});

/**
 * Switch active company
 * PUT /api/auth/switch-company/:id
 */
export const switchCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const companyId = String(req.params.id);

    // Validate ObjectId
    if (!Types.ObjectId.isValid(companyId)) {
        throw new NotFoundError('Company');
    }

    const userId = req.user!.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
        throw new NotFoundError('User');
    }

    // Check if company is in allowed list (or user is admin)
    const isAdmin = user.roles.includes(UserRole.MASTER);
    // const isAllowed = user.allowedCompanyIds.some((cid) => cid.toString() === companyId);
    const isAllowed = (user.companyAccess || []).some(a => a.companyId.toString() === companyId);

    if (!isAdmin && !isAllowed) {
        throw new UnauthorizedError('Access to this company is not allowed');
    }

    // Verify company exists and is active
    const company = await Company.findOne({ _id: companyId, isActive: true });
    if (!company) {
        throw new NotFoundError('Company');
    }

    // Update active company
    user.activeCompanyId = company._id as Types.ObjectId;
    await user.save();

    res.json({
        success: true,
        data: {
            activeCompanyId: company._id,
            activeCompany: {
                id: company._id,
                name: company.name,
                sectors: company.sectors,
            },
        },
        message: `Switched to company: ${company.name}`,
    });
});

