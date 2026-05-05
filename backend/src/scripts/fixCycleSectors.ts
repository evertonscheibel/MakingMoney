import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/makingmoney';

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');

    const Cycle = mongoose.connection.collection('cycles');

    // Update all cycles where sector is undefined, null, or 'undefined' string
    const result = await Cycle.updateMany(
        { $or: [{ sector: { $exists: false } }, { sector: null }, { sector: 'undefined' }] },
        { $set: { sector: 'Controladoria' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} cycles to sector 'Controladoria'.`);

    // Verify
    const updated = await Cycle.find({}).toArray();
    updated.forEach(c => {
        console.log(`Month: ${c.month} | Sector: '${c.sector}'`);
    });

    await mongoose.disconnect();
}

main().catch(console.error);

