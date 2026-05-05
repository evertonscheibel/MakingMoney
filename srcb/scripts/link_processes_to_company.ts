
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Process } from '../models';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        const admin = await User.findOne({ email: 'admin@metodochronos.com' });
        if (!admin || !admin.activeCompanyId) {
            console.error('Admin user or activeCompanyId not found.');
            process.exit(1);
        }

        const companyId = admin.activeCompanyId;
        console.log(`Target Company ID: ${companyId}`);

        const result = await Process.updateMany(
            {},
            { $set: { companyId: companyId } }
        );

        console.log(`Updated ${result.modifiedCount} processes to belong to company ${companyId}`);

        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

migrate();

