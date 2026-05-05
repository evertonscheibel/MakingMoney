import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, UserRole } from '../types';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        passwordHash: {
            type: String,
            required: true,
            select: false, // Don't include by default in queries
        },
        roles: {
            type: [String],
            enum: Object.values(UserRole),
            default: [UserRole.OPERATOR],
            validate: {
                validator: (v: string[]) => v.length > 0,
                message: 'User must have at least one role',
            },
        },
        companyAccess: [{
            companyId: {
                type: Schema.Types.ObjectId,
                ref: 'Company',
                required: true
            },
            role: {
                type: String,
                enum: Object.values(UserRole),
                default: UserRole.OPERATOR
            },
            _id: false
        }],
        activeCompanyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            default: null,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: {
            type: String,
            default: null,
        },
        emailVerificationExpires: {
            type: Date,
            default: null,
        },
        allowedMenus: {
            type: [String],
            default: ['dashboard'], // Menus padrão mínimos
        },
        position: {
            type: String,
            trim: true,
        },
        department: {
            type: String,
            trim: true,
        },
        baseSalary: {
            type: Number,
            default: 0,
        },
        sector: {
            type: String,
            trim: true,
        },
        sectors: {
            type: [String],
            default: [],
        },
        resetPasswordToken: {
            type: String,
            default: null,
        },
        resetPasswordExpires: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_, ret) => {
                const r = ret as any;
                delete r.passwordHash;
                delete r.__v;
                return r;
            },
        },
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) {
        return next();
    }
    try {
        const doc = this as any;
        const salt = await bcrypt.genSalt(12);
        doc.passwordHash = await bcrypt.hash(doc.passwordHash, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, (this as any).passwordHash);
};

export const User = mongoose.model<IUserDocument>('User', userSchema);

