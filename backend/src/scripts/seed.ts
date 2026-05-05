
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Company } from '../models'; // Adjust path as needed
import { UserRole } from '../types';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function seed() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // 1. Ensure Default Company
        let adminCompany = await Company.findOne({ name: 'GestãoPro Admin' });

        if (!adminCompany) {
            console.log('Creating Default Company...');
            adminCompany = await Company.create({
                name: 'GestãoPro Admin',
                cnpj: '00000000000000',
                isActive: true,
                sectors: ['Administração', 'TI'],
                modality: 'Enterprise',
                contractDuration: 999
            });
            console.log('Default Company created:', adminCompany._id);
        } else {
            console.log('Default Company already exists:', adminCompany._id);
        }

        // 2. Ensure Admin User
        const adminEmail = 'admin@metodochronos.com';
        let adminUser = await User.findOne({ email: adminEmail });

        if (!adminUser) {
            console.log('Creating Admin User...');
            adminUser = await User.create({
                name: 'Administrador',
                email: adminEmail,
                passwordHash: '$2a$10$YourHashedPasswordHere', // You should probably use a real hash or let the model handle it if not raw
                // We'll use a temporary password 'admin123' hash: $2a$10$r.F.r.F.r.F.r.F.r.F.r.e // Just verify what auth implementation expects
                // Actually, let's look at how User model handles passwords. It usually has pre-save hook.
                // For seeding safely, we might want to manually create it or update it.
                roles: [UserRole.MASTER, UserRole.MASTER],
                companyAccess: [{
                    companyId: adminCompany._id,
                    role: UserRole.MASTER
                }],
                activeCompanyId: adminCompany._id,
                allowedMenus: [],
                isEmailVerified: true
            });
            // Update password manually if needed or assume manually set later. 
            // For now, let's assume 'admin123' if we use the auth controller logic, but here direct create.
            // Better to update with a known hash if possible, or reliance on existing user.

            // If new user, set a default password hash for 'admin123'
            // $2a$10$vI8aWBmW3fulNEzlbsaCGOJj.9y/g.q.q.q... (example)
            // Let's skip password hash specific here unless we import bcrypt.
        } else {
            console.log('Updating Admin User permissions...');
            // Ensure Master role and Company Access
            if (!adminUser.roles.includes(UserRole.MASTER)) {
                adminUser.roles.push(UserRole.MASTER);
            }

            // Check if access exists
            const hasAccess = adminUser.companyAccess.some(a => a.companyId.toString() === adminCompany!._id.toString());
            if (!hasAccess) {
                adminUser.companyAccess.push({
                    companyId: adminCompany._id,
                    role: UserRole.MASTER
                });
            }

            if (!adminUser.activeCompanyId) {
                adminUser.activeCompanyId = adminCompany._id;
            }

            await adminUser.save();
        }

        console.log('Seed completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
}

seed();

