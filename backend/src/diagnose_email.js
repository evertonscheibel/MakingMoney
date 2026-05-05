const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/MMdb')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Check Queues
        const pendingCount = await mongoose.connection.db.collection('emailqueues').countDocuments({ status: 'PENDING' });
        const sendingCount = await mongoose.connection.db.collection('emailqueues').countDocuments({ status: 'SENDING' });
        const sentCount = await mongoose.connection.db.collection('emailqueues').countDocuments({ status: 'SENT' });
        const failedCount = await mongoose.connection.db.collection('emailqueues').countDocuments({ status: 'FAILED' });
        const retryCount = await mongoose.connection.db.collection('emailqueues').countDocuments({ status: 'RETRY_SCHEDULED' });

        console.log('\n--- Email Queue Stats ---');
        console.log(`PENDING: ${pendingCount}`);
        console.log(`SENDING: ${sendingCount}`);
        console.log(`SENT: ${sentCount}`);
        console.log(`FAILED: ${failedCount}`);
        console.log(`RETRY_SCHEDULED: ${retryCount}`);

        // Check Configs
        const configs = await mongoose.connection.db.collection('emailconfigs').find({}).toArray();
        console.log('\n--- Email Configurations ---');
        if (configs.length === 0) {
            console.log('No email configurations found!');
        } else {
            configs.forEach(c => {
                console.log(`Company: ${c.companyId}`);
                console.log(`  Active: ${c.isActive}`);
                console.log(`  Host: ${c.host}`);
                console.log(`  Port: ${c.port}`);
                console.log(`  User: ${c.auth ? c.auth.user : 'N/A'}`);
                console.log(`  From: ${c.fromEmail}`);
            });
        }

        // Check recent failures
        if (failedCount > 0 || retryCount > 0) {
            console.log('\n--- Recent Errors ---');
            const errors = await mongoose.connection.db.collection('emailqueues').find({
                status: { $in: ['FAILED', 'RETRY_SCHEDULED'] }
            }).sort({ updatedAt: -1 }).limit(5).toArray();

            errors.forEach(e => {
                console.log(`[${e.status}] To: ${e.to} | Error: ${e.lastError}`);
            });
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
