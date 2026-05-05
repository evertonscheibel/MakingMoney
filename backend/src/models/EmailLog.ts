import { Schema, model, Document } from 'mongoose';

export enum EmailLogStatus {
    SENT = 'SENT',
    FAILED = 'FAILED'
}

export interface IEmailLog {
    companyId: Schema.Types.ObjectId;
    queueId?: Schema.Types.ObjectId;
    processId?: Schema.Types.ObjectId;
    entityType?: string;
    entityId?: Schema.Types.ObjectId;
    createdByUserId?: Schema.Types.ObjectId;
    to: string;
    subject: string;
    category?: string;
    status: EmailLogStatus;
    providerMessageId?: string;
    error?: string;
    sentAt: Date;
    metadata?: Record<string, any>;
}

export interface IEmailLogDocument extends IEmailLog, Document { }

const emailLogSchema = new Schema<IEmailLogDocument>(
    {
        companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
        queueId: { type: Schema.Types.ObjectId, ref: 'EmailQueue' },
        processId: { type: Schema.Types.ObjectId, ref: 'Process', index: true },
        entityType: { type: String },
        entityId: { type: Schema.Types.ObjectId, index: true },
        createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        to: { type: String, required: true },
        subject: { type: String, required: true },
        category: { type: String },
        status: {
            type: String,
            enum: Object.values(EmailLogStatus),
            required: true
        },
        providerMessageId: { type: String },
        error: { type: String },
        sentAt: { type: Date, default: Date.now },
        metadata: { type: Schema.Types.Mixed },
    },
    {
        versionKey: false
    }
);

emailLogSchema.index({ sentAt: -1 });
emailLogSchema.index({ companyId: 1, processId: 1 });
emailLogSchema.index({ companyId: 1, sentAt: -1 });

export const EmailLog = model<IEmailLogDocument>('EmailLog', emailLogSchema);

