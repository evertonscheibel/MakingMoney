import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Process } from '../models';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function migrate() {
    try {
        console.log('🌱 Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        const processes = await Process.find().sort({ createdAt: 1 });
        console.log(`🚀 Migrating ${processes.length} processes...`);

        let counter = 1;
        for (const p of processes) {
            const newCode = counter.toString().padStart(3, '0');
            await Process.updateOne({ _id: p._id }, { $set: { code: newCode } });
            console.log(`   ${p.code} -> ${newCode}`);
            counter++;
        }

        console.log('✅ Migration completed successfully');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

migrate();

