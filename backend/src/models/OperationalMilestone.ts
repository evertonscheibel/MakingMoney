import { Schema, model } from 'mongoose';

const schema = new Schema({
    companyId: { type: Schema.Types.ObjectId, required: true, ref: 'Company' },
    sector: { type: String, required: true },
    processId: { type: Schema.Types.ObjectId, ref: 'Process' },
    lineageId: { type: Schema.Types.ObjectId },
    type: { type: String, enum: ['IMPLANTACAO', 'MARCO'], required: true },
    description: { type: String, required: true, maxlength: 1000 },
    occurredAt: { type: Date, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ companyId: 1, sector: 1, occurredAt: 1 });
export const OperationalMilestone = model('OperationalMilestone', schema);
