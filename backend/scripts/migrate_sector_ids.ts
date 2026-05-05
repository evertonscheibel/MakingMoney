
import mongoose from 'mongoose';
import { Process } from '../src/models';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    try {
        console.log('Dropping old unique index...');
        try {
            await Process.collection.dropIndex('companyId_1_cycleId_1_code_1');
            console.log('Old index dropped.');
        } catch (e: any) {
            console.log('Old index drop failed (maybe not exists):', e.message);
        }

        console.log('Syncing indexes (creating new ones)...');
        await Process.syncIndexes();

        const indexes = await Process.collection.indexes();
        console.log('Current Indexes:', JSON.stringify(indexes, null, 2));

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await mongoose.disconnect();
    }
}

run();

