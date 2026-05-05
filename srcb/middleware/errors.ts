import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { logger } from '../config';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
    errors: Array<{ field: string; message: string }>;

    constructor(errors: Array<{ field: string; message: string }>) {
        super('Validation failed', 400);
        this.errors = errors;
    }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401);
    }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
        super(message, 403);
    }
}

/**
 * Conflict Error (e.g., duplicate entries)
 */
export class ConflictError extends AppError {
    constructor(message: string = 'Resource already exists') {
        super(message, 409);
    }
}

/**
 * Validation middleware - runs validation chains and returns errors
 */
export function validate(validations: ValidationChain[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Run all validations
        await Promise.all(validations.map((validation) => validation.run(req)));

        const errors = validationResult(req);

        if (errors.isEmpty()) {
            next();
            return;
        }

        const formattedErrors = errors.array().map((err) => ({
            field: 'path' in err ? err.path : 'unknown',
            message: err.msg,
        }));

        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: formattedErrors,
        });
    };
}

/**
 * Global error handler
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction
): void {
    // Log the error
    if (err instanceof AppError && err.isOperational) {
        logger.warn(`Operational error: ${err.message}`);
    } else {
        logger.error('Unexpected error:', err);
    }

    // Handle known error types
    if (err instanceof ValidationError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            details: err.errors,
        });
        return;
    }

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
        });
        return;
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const mongooseErr = err as any;
        const errors = Object.keys(mongooseErr.errors).map((key) => ({
            field: key,
            message: mongooseErr.errors[key].message,
        }));

        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors,
        });
        return;
    }

    // Handle Mongoose duplicate key error
    if ((err as { code?: number }).code === 11000) {
        res.status(409).json({
            success: false,
            error: 'Duplicate entry',
        });
        return;
    }

    // Handle Mongoose cast errors (invalid ObjectId)
    if (err.name === 'CastError') {
        res.status(400).json({
            success: false,
            error: 'Invalid ID format',
        });
        return;
    }

    // Default to 500 server error
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
}

/**
 * Async handler wrapper - catches async errors
 */
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
    });
}

