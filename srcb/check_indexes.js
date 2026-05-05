
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const db = mongoose.connection.db;
        const indexes = await db.collection('processes').indexes();
        console.log('Indexes on processes collection:');
        console.log(JSON.stringify(indexes, null, 2));

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Failed:', error);
        process.exit(1);
    }
}

checkIndexes();
