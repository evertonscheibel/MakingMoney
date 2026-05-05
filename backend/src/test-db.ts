import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function testConnection() {
    console.log('Testing connection to:', MONGODB_URI);
    try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Success!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed!');
        console.error(err);
        process.exit(1);
    }
}

testConnection();

