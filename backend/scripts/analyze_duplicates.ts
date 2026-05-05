
import mongoose from 'mongoose';
import { Process } from '../src/models';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    const duplicates = await Process.aggregate([
        {
            $group: {
                _id: {
                    companyId: '$companyId',
                    cycleId: '$cycleId',
                    code: '$code'
                },
                count: { $sum: 1 },
                ids: { $push: '$_id' }
            }
        },
        {
            $match: {
                count: { $gt: 1 }
            }
        }
    ]);

    console.log(`Found ${duplicates.length} sets of duplicates.`);

    if (duplicates.length > 0) {
        console.log('Sample duplicate details:');
        for (let i = 0; i < Math.min(3, duplicates.length); i++) {
            console.log(JSON.stringify(duplicates[i], null, 2));
        }
    }

    await mongoose.disconnect();
}

run();

