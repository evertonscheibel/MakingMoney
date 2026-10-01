import mongoose, { Schema, Document } from 'mongoose';
import { ICompany } from '../types';

export interface ICompanyDocument extends Omit<ICompany, '_id'>, Document { }

const companySchema = new Schema<ICompanyDocument>(
    {
        name: {
            type: String,
            required: [true, 'Company name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        cnpj: {
            type: String,
            trim: true,
            sparse: true, // Permite nulo e mantém unicidade se houver valor
        },
        address: {
            street: String,
            number: String,
            city: String,
            state: String,
            zipCode: String,
        },
        contractDuration: {
            type: Number,
            default: 12,
        },
        modality: {
            type: String,
            default: 'Padrão',
        },
        sectors: {
            type: ([{
                name: {
                    type: String,
                    required: true,
                    trim: true,
                },
                managerId: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    default: null,
                },
                managerIds: [{
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                }],
                cycleAutomation: {
                    enabled: { type: Boolean, default: false },
                    closingDay: { type: Number, min: 1, max: 31, default: 1 },
                    closingTime: { type: String, default: '00:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
                    timezone: { type: String, default: 'America/Cuiaba' },
                    sundayPlannedRule: { type: String, enum: ['KEEP', 'PREVIOUS_DAY', 'PREVIOUS_BUSINESS_DAY', 'NEXT_DAY', 'NEXT_BUSINESS_DAY'], default: 'PREVIOUS_BUSINESS_DAY' },
                    sundayLimitRule: { type: String, enum: ['KEEP', 'PREVIOUS_DAY', 'PREVIOUS_BUSINESS_DAY', 'NEXT_DAY', 'NEXT_BUSINESS_DAY'], default: 'NEXT_BUSINESS_DAY' },
                },
                _id: { type: Schema.Types.ObjectId, auto: true }
            }] as any),
            default: [],
            validate: {
                validator: function (v: any[]) {
                    // Check for duplicates (case-insensitive)
                    const normalized = v
                        .filter((s: any) => s && s.name)
                        .map((s: any) => s.name.toLowerCase().trim());
                    return new Set(normalized).size === normalized.length;
                },
                message: 'Sectors must be unique',
            },
        },
        isActive: {
            type: Boolean,
            default: true,
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

// Index for active companies
companySchema.index({ isActive: 1 });
companySchema.index({ name: 1 });

export const Company = mongoose.model<ICompanyDocument>('Company', companySchema);

