
import mongoose, { Schema, Document } from 'mongoose';

export interface ICycleRestorePoint extends Document {
    companyId: mongoose.Types.ObjectId;
    cycleId: mongoose.Types.ObjectId;
    createdByUserId: mongoose.Types.ObjectId;
    timestamp: Date;
    processes: any[]; // Array of Process objects (snapshots)
    cycleKPIs: any; // Snapshot of KPIs
}

const cycleRestorePointSchema = new Schema<ICycleRestorePoint>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
            index: true,
        },
        cycleId: {
            type: Schema.Types.ObjectId,
            ref: 'Cycle',
            required: true,
            index: true,
        },
        createdByUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        processes: {
            type: [Schema.Types.Mixed],
            required: true,
        },
        cycleKPIs: {
            type: Schema.Types.Mixed,
            required: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false }, // Only createdAt needed
    }
);

// TTL Index: Automatically delete restore points after 30 days
cycleRestorePointSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const CycleRestorePoint = mongoose.model<ICycleRestorePoint>('CycleRestorePoint', cycleRestorePointSchema);

