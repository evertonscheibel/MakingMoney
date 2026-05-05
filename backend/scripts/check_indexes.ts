
import mongoose from 'mongoose';
import { Cycle } from '../src/models';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    const indexes = await Cycle.collection.indexes();
    console.log('Indexes on cycles collection:');
    console.log(JSON.stringify(indexes, null, 2));

    await mongoose.disconnect();
}

run();

