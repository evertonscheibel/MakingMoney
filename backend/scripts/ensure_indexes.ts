
import mongoose from 'mongoose';
import { Process } from '../src/models';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    console.log('Syncing indexes...');
    try {
        await Process.syncIndexes();
        console.log('Indexes Synced');
    } catch (e) {
        console.error('Error syncing indexes (maybe duplicates exist?):', e);
    }

    const indexes = await Process.collection.indexes();
    console.log('Current Indexes:', JSON.stringify(indexes, null, 2));

    await mongoose.disconnect();
}

run();

