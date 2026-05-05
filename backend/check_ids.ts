import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Company, Cycle, User } from './src/models';

dotenv.config({ path: path.join(__dirname, '.env') });

async function findData() {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/makingmoney';
        console.log('Connecting to:', uri);
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const company = await Company.findOne({ name: /Frizelo/i });
        if (!company) {
            console.log('Company not found');
            return;
        }
        console.log('Company:', { id: company._id, name: company.name });

        const cycle = await Cycle.findOne({ companyId: company._id, status: 'OPEN' });
        console.log('Open Cycle:', cycle ? { id: cycle._id, month: cycle.month } : 'None found');

        const adminUser = await User.findOne({ companyAccess: company._id, roles: 'ADMIN' });
        console.log('Admin User:', adminUser ? { id: adminUser._id, name: adminUser.name } : 'None found');

        // Also list all users for this company to see who can be responsible
        const users = await User.find({ companyAccess: company._id });
        console.log('Users found:', users.map(u => ({ id: u._id, name: u.name, roles: u.roles })));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findData();
