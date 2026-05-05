
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function restoreDeletedProcess() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const db = mongoose.connection.db;

        // Find all DELETE audit logs, sorted by createdAt descending
        const deleteLogs = await db.collection('auditlogs').find({
            action: 'DELETE'
        }).sort({ createdAt: -1 }).limit(5).toArray();

        console.log(`Found ${deleteLogs.length} DELETE logs`);

        if (deleteLogs.length === 0) {
            console.log('No deleted processes found.');
            process.exit(0);
        }

        // Use the first (most recent) delete
        const lastDelete = deleteLogs[0];
        console.log('Last delete:', JSON.stringify(lastDelete, null, 2));

        if (!lastDelete.before) {
            console.log('No "before" data in audit log. Cannot restore.');
            process.exit(0);
        }

        // Check if it already exists
        const existing = await db.collection('processes').findOne({
            _id: new mongoose.Types.ObjectId(lastDelete.entityId)
        });

        if (existing) {
            console.log('Process already exists! Nothing to restore.');
            process.exit(0);
        }

        // Restore the process
        const processToRestore = { ...lastDelete.before };
        processToRestore._id = new mongoose.Types.ObjectId(lastDelete.entityId);
        processToRestore.companyId = new mongoose.Types.ObjectId(processToRestore.companyId);
        processToRestore.cycleId = new mongoose.Types.ObjectId(processToRestore.cycleId);
        if (processToRestore.responsibleUserId) {
            processToRestore.responsibleUserId = new mongoose.Types.ObjectId(processToRestore.responsibleUserId);
        }
        processToRestore.plannedDate = new Date(processToRestore.plannedDate);
        processToRestore.limitDate = new Date(processToRestore.limitDate);
        if (processToRestore.createdAt) processToRestore.createdAt = new Date(processToRestore.createdAt);
        processToRestore.updatedAt = new Date();

        await db.collection('processes').insertOne(processToRestore);
        console.log('\n=== PROCESS RESTORED ===');
        console.log('Title:', processToRestore.title);
        console.log('Code:', processToRestore.code);
        console.log('Sector:', processToRestore.sector);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Restore failed:', error);
        process.exit(1);
    }
}

restoreDeletedProcess();
