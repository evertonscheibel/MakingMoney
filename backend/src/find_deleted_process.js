
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function findLastDeletedProcess() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const db = mongoose.connection.db;

        // List all audit log entries
        const allLogs = await db.collection('auditlogs').find({}).sort({ timestamp: -1 }).limit(20).toArray();

        console.log('\n=== RECENT AUDIT LOGS ===');
        console.log(`Total found: ${allLogs.length}`);
        allLogs.forEach(log => {
            console.log(`${log.timestamp} | ${log.action} | ${log.entityType} | ID: ${log.entityId}`);
        });

        // Look for DELETE
        const deletes = allLogs.filter(l => l.action === 'DELETE');
        console.log(`\nDelete logs: ${deletes.length}`);

        if (deletes.length > 0) {
            console.log('\n=== LAST DELETED ENTRY ===');
            console.log(JSON.stringify(deletes[0], null, 2));
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Failed:', error);
        process.exit(1);
    }
}

findLastDeletedProcess();
