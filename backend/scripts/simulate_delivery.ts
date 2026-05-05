
import mongoose from 'mongoose';
import { Process } from '../src/models';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    try {
        // Find a pending process
        const process = await Process.findOne({ deliveryDate: null });

        if (process) {
            console.log(`Delivering process ${process.code}...`);
            process.deliveryDate = new Date(); // Deliver today
            process.deliveryStatus = 'CONFIRMED_PENDING_EMAIL'; // Or whatever enum
            await process.save();
            console.log(`Process ${process.code} marked as delivered on ${process.deliveryDate}`);
        } else {
            console.log('No pending process found to deliver.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();

