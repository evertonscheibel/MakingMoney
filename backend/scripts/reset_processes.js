
const mongoose = require('mongoose');
require('dotenv').config();

const resetProcesses = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/MMdb');
        console.log('Connected to MongoDB');

        const result = await mongoose.connection.collection('processes').updateMany(
            {},
            {
                $set: {
                    deliveryDate: null,
                    deliverySource: null,
                    deliveryEvidence: null,
                    score: null,
                    status: 'pendente'
                }
            }
        );

        console.log(`Reset complete. Modified ${result.modifiedCount} documents.`);
        process.exit(0);
    } catch (error) {
        console.error('Error resetting processes:', error);
        process.exit(1);
    }
};

resetProcesses();
