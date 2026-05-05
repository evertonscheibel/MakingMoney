import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/makingmoney';

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    const Cycle = mongoose.connection.collection('cycles');

    console.log('=== RAW CYCLE DATA ===');
    const cycles = await Cycle.find({}).toArray();

    cycles.forEach(c => {
        console.log(`ID: ${c._id}`);
        console.log(`Month: ${c.month}`);
        console.log(`Sector: '${c.sector}' (Valid string: ${typeof c.sector === 'string'})`);
        console.log(`Status: ${c.status}`);
        console.log(`Company: ${c.companyId}`);
        console.log('---');
    });

    await mongoose.disconnect();
}

main().catch(console.error);

