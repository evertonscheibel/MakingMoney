const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/MMdb';

async function listCompanies() {
    try {
        await mongoose.connect(MONGODB_URI);
        const companies = await mongoose.connection.collection('companies').find({}).toArray();
        console.log(JSON.stringify(companies, null, 2));
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

listCompanies();
