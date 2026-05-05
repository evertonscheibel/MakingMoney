
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function removeProcesses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const db = mongoose.connection.db;

        // Count processes in Contabilidade/Fiscal sector
        const count = await db.collection('processes').countDocuments({
            sector: 'Contabilidade/Fiscal'
        });

        console.log(`Found ${count} processes in Contabilidade/Fiscal sector.`);

        if (count === 0) {
            console.log('Nothing to delete.');
            process.exit(0);
        }

        // Delete all processes from this sector
        const result = await db.collection('processes').deleteMany({
            sector: 'Contabilidade/Fiscal'
        });

        console.log(`Deleted ${result.deletedCount} processes from Contabilidade/Fiscal sector.`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Failed:', error);
        process.exit(1);
    }
}

removeProcesses();
