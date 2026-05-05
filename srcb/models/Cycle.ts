import mongoose, { Schema, Document } from 'mongoose';
import { ICycle, CycleStatus, ICycleKPIs } from '../types';

export interface ICycleDocument extends Omit<ICycle, '_id'>, Document { }

const kpisSchema = new Schema<ICycleKPIs>(
    {
        avgScore: { type: Number, default: 0 },
        onTimePct: { type: Number, default: 0 },
        criticalCount: { type: Number, default: 0 },
        totalProcesses: { type: Number, default: 0 },
        avgDeviationDays: { type: Number, default: 0 },
    },
    { _id: false }
);

const cycleSchema = new Schema<ICycleDocument>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: [true, 'Company ID is required'],
            index: true,
        },
        month: {
            type: String,
            required: [true, 'Month is required'],
            match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'],
        },
        sector: {
            type: String,
            required: [true, 'Sector is required'],
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(CycleStatus),
            default: CycleStatus.OPEN,
        },
        openedAt: {
            type: Date,
            default: Date.now,
        },
        closedAt: {
            type: Date,
            default: null,
        },
        kpis: {
            type: kpisSchema,
            default: () => ({
                avgScore: 0,
                onTimePct: 0,
                criticalCount: 0,
                totalProcesses: 0,
                avgDeviationDays: 0,
            }),
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
cycleSchema.index({ companyId: 1, sector: 1, month: 1 }, { unique: true });
cycleSchema.index({ companyId: 1, sector: 1, status: 1 });

// Helper to get current month in YYYY-MM format
export function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Helper to get next month in YYYY-MM format
export function getNextMonth(month: string): string {
    const [year, m] = month.split('-').map(Number);
    if (m === 12) {
        return `${year + 1}-01`;
    }
    return `${year}-${String(m + 1).padStart(2, '0')}`;
}


// Cascading delete: When a cycle is deleted, delete all its processes
cycleSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    const cycleId = this._id;
    try {
        const { Process } = await import('./Process');
        await Process.deleteMany({ cycleId });
        next();
    } catch (error) {
        next(error as Error);
    }
});

cycleSchema.pre('deleteOne', { document: false, query: true }, async function (next) {
    try {
        const doc = await this.model.findOne(this.getFilter());
        if (doc) {
            const { Process } = await import('./Process');
            await Process.deleteMany({ cycleId: doc._id });
        }
        next();
    } catch (error) {
        next(error as Error);
    }
});

export const Cycle = mongoose.model<ICycleDocument>('Cycle', cycleSchema);


