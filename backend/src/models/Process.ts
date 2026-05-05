import mongoose, { Schema, Document } from 'mongoose';
import { IProcess, ProcessStatus, DeliverySource, DeliveryStatus } from '../types';

export interface IProcessDocument extends Omit<IProcess, '_id'>, Document { }

const processSchema = new Schema<IProcessDocument>(
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
            required: [true, 'Cycle ID is required'],
            index: true,
        },
        code: {
            type: String,
            required: [true, 'Process code is required'],
            trim: true,
            match: [/^\d{1,5}$/, 'Code must be numeric (e.g., 001)'],
        },
        title: {
            type: String,
            required: [true, 'Process title is required'],
            trim: true,
            minlength: [3, 'Title must be at least 3 characters'],
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        sector: {
            type: String,
            required: [true, 'Sector is required'],
            trim: true,
        },
        owner: {
            type: String,
            default: null,
            trim: true,
        },
        plannedDate: {
            type: Date,
            required: [true, 'Planned date is required'],
        },
        limitDate: {
            type: Date,
            required: [true, 'Limit date is required'],
        },
        deliveryDate: {
            type: Date,
            default: null,
        },
        deliverySource: {
            type: String,
            enum: [...Object.values(DeliverySource), null],
            default: null,
        },
        deliveryEvidence: {
            type: String,
            default: null,
            trim: true,
        },
        score: {
            type: Number,
            default: null,
            min: [0, 'Score cannot be negative'],
            max: [100, 'Score cannot exceed 100'],
        },
        status: {
            type: String,
            enum: Object.values(ProcessStatus),
            default: ProcessStatus.PENDING,
        },
        responsibleUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        deliveryStatus: {
            type: String,
            enum: Object.values(DeliveryStatus),
            default: DeliveryStatus.NOT_DELIVERED,
        },
        emailSentAt: {
            type: Date,
            default: null,
        },
        revertReason: {
            type: String,
            default: null,
            trim: true,
        },
        revertedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        revertedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
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
processSchema.index({ companyId: 1, cycleId: 1 });
// Global unique index for Code per Company AND SECTOR AND CYCLE
processSchema.index({ companyId: 1, cycleId: 1, sector: 1, code: 1 }, { unique: true });
processSchema.index({ companyId: 1, sector: 1 });
processSchema.index({ companyId: 1, status: 1 });

// Validation: limitDate must be >= plannedDate and sector must match cycle sector
processSchema.pre('save', async function (next) {
    if (this.isModified('limitDate') || this.isModified('plannedDate')) {
        if (this.limitDate < this.plannedDate) {
            return next(new Error('Limit date cannot be before planned date'));
        }
    }

    if (this.isModified('cycleId') || this.isModified('sector')) {
        try {
            const { Cycle } = await import('./Cycle');
            const cycle = await Cycle.findById(this.cycleId);
            if (cycle && cycle.sector !== this.sector) {
                return next(new Error(`Process sector (${this.sector}) must match cycle sector (${cycle.sector})`));
            }
        } catch (error) {
            return next(error as Error);
        }
    }

    next();
});

export const Process = mongoose.model<IProcessDocument>('Process', processSchema);

