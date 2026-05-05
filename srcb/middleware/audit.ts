import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models';
import { AuditAction, EntityType } from '../types';
import { logger } from '../config';
import { Types } from 'mongoose';

export interface AuditContext {
    action: AuditAction;
    entityType: EntityType;
    entityId: Types.ObjectId | string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
    companyId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    context: AuditContext
): Promise<void> {
    try {
        await AuditLog.create({
            companyId: new Types.ObjectId(companyId.toString()),
            actorUserId: new Types.ObjectId(userId.toString()),
            action: context.action,
            entityType: context.entityType,
            entityId: new Types.ObjectId(context.entityId.toString()),
            before: context.before || null,
            after: context.after || null,
        });
    } catch (error) {
        // Log error but don't fail the main operation
        logger.error('Failed to create audit log:', error);
    }
}

/**
 * Audit middleware factory - wraps controller functions with audit logging
 */
export function withAudit(
    action: AuditAction,
    entityType: EntityType,
    getEntityId: (req: Request, res: Response) => string | null,
    getBeforeState?: (req: Request) => Promise<Record<string, unknown> | null>
) {
    return (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const beforeState = getBeforeState ? await getBeforeState(req) : null;

            // Store original json method
            const originalJson = res.json.bind(res);

            // Override json to capture response
            res.json = function (body: unknown) {
                // Only audit successful responses
                if (res.statusCode >= 200 && res.statusCode < 300 && req.companyId) {
                    const entityId = getEntityId(req, res);

                    if (entityId) {
                        const afterState = (body as { data?: Record<string, unknown> })?.data || null;

                        createAuditLog(req.companyId, req.user!.userId, {
                            action,
                            entityType,
                            entityId,
                            before: beforeState,
                            after: afterState as Record<string, unknown>,
                        }).catch((err) => logger.error('Audit log failed:', err));
                    }
                }

                return originalJson(body);
            };

            await handler(req, res, next);
        };
    };
}

/**
 * Simple audit helper - logs without wrapping
 */
export async function auditAction(
    req: Request,
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    before: Record<string, unknown> | null = null,
    after: Record<string, unknown> | null = null
): Promise<void> {
    if (!req.user || !req.companyId) {
        logger.warn('Attempted to audit without user or company context');
        return;
    }

    const meta = {
        ip: req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
    };

    try {
        await AuditLog.create({
            companyId: new Types.ObjectId(req.companyId.toString()),
            actorUserId: new Types.ObjectId(req.user.userId.toString()),
            action,
            entityType,
            entityId: new Types.ObjectId(entityId),
            before,
            after,
            meta,
        });
    } catch (error) {
        logger.error('Failed to create audit log:', error);
    }
}

