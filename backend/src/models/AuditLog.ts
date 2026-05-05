import mongoose, { Schema, Document } from 'mongoose';
import { IAuditLog, AuditAction, EntityType } from '../types';

export interface IAuditLogDocument extends Omit<IAuditLog, '_id'>, Document { }

const auditLogSchema = new Schema<IAuditLogDocument>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: [true, 'Company ID is required'],
            index: true,
        },
        actorUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Actor user ID is required'],
        },
        action: {
            type: String,
            enum: Object.values(AuditAction),
            required: [true, 'Action is required'],
        },
        entityType: {
            type: String,
            enum: Object.values(EntityType),
            required: [true, 'Entity type is required'],
        },
        entityId: {
            type: Schema.Types.ObjectId,
            required: [true, 'Entity ID is required'],
        },
        before: {
            type: Schema.Types.Mixed,
            default: null,
        },
        after: {
            type: Schema.Types.Mixed,
            default: null,
        },
        meta: {
            type: {
                ip: String,
                userAgent: String,
            },
            default: null,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        toJSON: {
            transform: (_, ret) => {
                const r = ret as any;
                delete r.__v;
                return r;
            },
        },
    }
);

// Indexes
auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);

