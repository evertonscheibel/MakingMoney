const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/MMdb';

async function checkCycles() {
    try {
        await mongoose.connect(MONGODB_URI);
        const cycles = await mongoose.connection.collection('cycles').find({ sector: 'Controladoria' }).toArray();
        console.log('--- Cycles for Controladoria ---');
        console.log(JSON.stringify(cycles, null, 2));

        const openCycles = await mongoose.connection.collection('cycles').find({ status: 'OPEN' }).toArray();
        console.log('\n--- All OPEN Cycles ---');
        console.log(JSON.stringify(openCycles, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCycles();
