import { Schema, model, Document } from 'mongoose';

export interface IEmailTemplateDocument extends Document {
    companyId: Schema.Types.ObjectId;
    category: string;
    label: string;
    subject: string;
    htmlBody: string;
    isActive: boolean;
}

const emailTemplateSchema = new Schema<IEmailTemplateDocument>({
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    category: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    htmlBody: { type: String, required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

emailTemplateSchema.index({ companyId: 1, category: 1 }, { unique: true });
export const EmailTemplate = model<IEmailTemplateDocument>('EmailTemplate', emailTemplateSchema);
