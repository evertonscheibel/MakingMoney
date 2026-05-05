
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Company, Process } from '../models';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function debug() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        console.log('\n--- ADMIN USER ---');
        const admin = await User.findOne({ email: 'admin@metodochronos.com' });
        if (admin) {
            console.log('ID:', admin._id);
            console.log('Roles:', admin.roles);
            console.log('Active Company ID:', admin.activeCompanyId);
            console.log('Company Access:', JSON.stringify(admin.companyAccess, null, 2));
        } else {
            console.log('Admin user not found!');
        }

        console.log('\n--- COMPANIES ---');
        const companies = await Company.find({});
        companies.forEach(c => {
            console.log(`Company: ${c.name} (${c._id}) - Active: ${c.isActive}`);
        });

        console.log('\n--- PROCESSES (First 5) ---');
        const processes = await Process.find({}).limit(5);
        if (processes.length === 0) {
            console.log('No processes found.');
        } else {
            processes.forEach(p => {
                console.log(`Process ${p.code}: CompanyID=${p.companyId}, CycleID=${p.cycleId}`);
            });
        }

        const totalProcesses = await Process.countDocuments({});
        console.log(`\nTotal Processes: ${totalProcesses}`);

        if (admin && admin.activeCompanyId) {
            const countForActive = await Process.countDocuments({ companyId: admin.activeCompanyId });
            console.log(`Processes explicitly for Admin's Active Company (${admin.activeCompanyId}): ${countForActive}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Debug error:', error);
        process.exit(1);
    }
}

debug();

