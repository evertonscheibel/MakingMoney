import mongoose, { Schema, Document } from 'mongoose';
import { IEmailEvent, EmailEventStatus } from '../types';

export interface IEmailEventDocument extends Omit<IEmailEvent, '_id'>, Document { }

const emailEventSchema = new Schema<IEmailEventDocument>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: [true, 'Company ID is required'],
            index: true,
        },
        cycleId: {
            type: Schema.Types.ObjectId,
            ref: 'Cycle',
            default: null,
        },
        subject: {
            type: String,
            required: [true, 'Subject is required'],
            trim: true,
        },
        from: {
            type: String,
            required: [true, 'From address is required'],
            trim: true,
            lowercase: true,
        },
        receivedAt: {
            type: Date,
            required: [true, 'Received date is required'],
        },
        matchedCode: {
            type: String,
            default: null,
            uppercase: true,
        },
        matchedProcessId: {
            type: Schema.Types.ObjectId,
            ref: 'Process',
            default: null,
        },
        resultStatus: {
            type: String,
            enum: Object.values(EmailEventStatus),
            required: true,
        },
        processedAt: {
            type: Date,
            default: Date.now,
        },
        rawPayload: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: false,
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
emailEventSchema.index({ companyId: 1, receivedAt: -1 });
emailEventSchema.index({ matchedProcessId: 1 });

export const EmailEvent = mongoose.model<IEmailEventDocument>(
    'EmailEvent',
    emailEventSchema
);

