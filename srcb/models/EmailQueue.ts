import { Schema, model, Document } from 'mongoose';

export enum EmailStatus {
    PENDING = 'PENDING',
    SENDING = 'SENDING',
    SENT = 'SENT',
    FAILED = 'FAILED',
    RETRY_SCHEDULED = 'RETRY_SCHEDULED'
}

export interface IEmailQueue {
    companyId: Schema.Types.ObjectId;
    to: string;
    subject: string;
    body: {
        html: string;
        text?: string;
    };
    category?: string; // e.g., 'alert', 'reset-password'
    entityId?: Schema.Types.ObjectId; // e.g., Ticket ID, User ID
    entityType?: string;
    createdByUserId?: Schema.Types.ObjectId;

    // Control
    status: EmailStatus;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt: Date;
    lastError?: string;

    createdAt: Date;
    updatedAt: Date;
}

export interface IEmailQueueDocument extends IEmailQueue, Document { }

const emailQueueSchema = new Schema<IEmailQueueDocument>(
    {
        companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
        to: { type: String, required: true },
        subject: { type: String, required: true },
        body: {
            html: { type: String, required: true },
            text: { type: String },
        },
        category: { type: String },
        entityId: { type: Schema.Types.ObjectId },
        entityType: { type: String },
        createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },

        status: {
            type: String,
            enum: Object.values(EmailStatus),
            default: EmailStatus.PENDING,
            index: true
        },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        nextAttemptAt: { type: Date, default: Date.now, index: true },
        lastError: { type: String },
    },
    {
        timestamps: true,
    }
);

// Index for worker polling
emailQueueSchema.index({ status: 1, nextAttemptAt: 1 });

export const EmailQueue = model<IEmailQueueDocument>('EmailQueue', emailQueueSchema);

