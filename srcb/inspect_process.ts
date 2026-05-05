import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Process } from './models/Process';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function inspect(code: string) {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        const process = await Process.findOne({ code });
        if (!process) {
            console.log('Process not found:', code);
        } else {
            console.log('Process found:', JSON.stringify(process, null, 2));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

const code = process.argv[2] || '001';
inspect(code);
