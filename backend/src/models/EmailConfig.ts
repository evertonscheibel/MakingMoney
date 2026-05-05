import { Schema, model, Document } from 'mongoose';

export enum SMTPSecurityMode {
    NONE = 'NONE',
    STARTTLS = 'STARTTLS',
    SSL_TLS = 'SSL_TLS'
}

export interface IEmailConfig {
    companyId: Schema.Types.ObjectId;
    host: string;
    port: number;
    securityMode: SMTPSecurityMode;
    auth: {
        user: string;
        pass: string; // Encrypted
    };
    fromName: string;
    fromEmail: string;
    replyTo?: string;
    isActive: boolean; // Global switch
    recipients: string[]; // List of default recipients

    // LGPD / Footer
    footerText?: string;

    updatedAt: Date;
    updatedBy?: Schema.Types.ObjectId;
}

export interface IEmailConfigDocument extends IEmailConfig, Document { }

const emailConfigSchema = new Schema<IEmailConfigDocument>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
            unique: true,
        },
        host: { type: String, required: true },
        port: { type: Number, required: true },
        securityMode: {
            type: String,
            enum: Object.values(SMTPSecurityMode),
            default: SMTPSecurityMode.STARTTLS
        },
        auth: {
            user: { type: String, required: true },
            pass: { type: String, required: true }, // Encrypted
        },
        fromName: { type: String, required: true },
        fromEmail: { type: String, required: true },
        replyTo: { type: String },
        isActive: { type: Boolean, default: true },
        recipients: { type: [String], default: [] }, // Default recipients
        footerText: { type: String },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

export const EmailConfig = model<IEmailConfigDocument>('EmailConfig', emailConfigSchema);

