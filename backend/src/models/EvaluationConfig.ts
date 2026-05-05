import mongoose, { Schema, Document } from 'mongoose';
import { IEvaluationConfig, IEvaluationRules, BonusCalculationMode } from '../types';

export interface IEvaluationConfigDocument
    extends Omit<IEvaluationConfig, '_id'>,
    Document { }

const rulesSchema = new Schema<IEvaluationRules>(
    {
        earlyDeliveryScore: {
            type: Number,
            default: 100,
            min: [0, 'Score cannot be negative'],
            max: [100, 'Score cannot exceed 100'],
        },
        onTimeScore: {
            type: Number,
            default: 75,
            min: [0, 'Score cannot be negative'],
            max: [100, 'Score cannot exceed 100'],
        },
        halfwayScore: {
            type: Number,
            default: 50,
            min: [0, 'Score cannot be negative'],
            max: [100, 'Score cannot exceed 100'],
        },
        lateScore: {
            type: Number,
            default: 25,
            min: [0, 'Score cannot be negative'],
            max: [100, 'Score cannot exceed 100'],
        },
        criticalScore: {
            type: Number,
            default: 0,
            min: [0, 'Score cannot be negative'],
            max: [100, 'Score cannot exceed 100'],
        },
        toleranceDays: {
            type: Number,
            default: 0,
            min: [0, 'Tolerance days cannot be negative'],
        },
        notificationEmails: {
            type: [String],
            default: [],
        },
        bonusCalculationMode: {
            type: String,
            enum: Object.values(BonusCalculationMode),
            default: BonusCalculationMode.INDIVIDUAL,
        },
    },
    { _id: false }
);

const evaluationConfigSchema = new Schema<IEvaluationConfigDocument>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: [true, 'Company ID is required'],
            index: true,
        },
        version: {
            type: Number,
            required: true,
            min: [1, 'Version must be at least 1'],
        },
        rules: {
            type: rulesSchema,
            required: true,
            default: () => ({}),
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator ID is required'],
        },
        isActive: {
            type: Boolean,
            default: true,
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
evaluationConfigSchema.index({ companyId: 1, isActive: 1 });
evaluationConfigSchema.index({ companyId: 1, version: 1 }, { unique: true });

// Get default rules
export function getDefaultRules(): IEvaluationRules {
    return {
        earlyDeliveryScore: 100,
        onTimeScore: 75,
        halfwayScore: 50,
        lateScore: 25,
        criticalScore: 0,
        toleranceDays: 0,
        notificationEmails: [],
        bonusCalculationMode: BonusCalculationMode.INDIVIDUAL,
    };
}

export const EvaluationConfig = mongoose.model<IEvaluationConfigDocument>(
    'EvaluationConfig',
    evaluationConfigSchema
);

