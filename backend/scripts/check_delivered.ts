
import mongoose from 'mongoose';
import { Process } from '../src/models';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    try {
        const deliveredProcesses = await Process.find({
            deliveryDate: { $ne: null }
        }).select('code title plannedDate limitDate deliveryDate status');

        console.log(`Found ${deliveredProcesses.length} delivered processes.`);

        if (deliveredProcesses.length > 0) {
            console.log('Sample Delivered Process:', JSON.stringify(deliveredProcesses[0], null, 2));
        } else {
            console.log('No delivered processes found in DB.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();

