/**
 * Script to cleanup all system logs
 * Clears: EmailLog, AuditLog, EmailQueue, EmailEvent, CycleRestorePoint
 * 
 * Usage: npx ts-node src/scripts/cleanup_logs.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function cleanupLogs() {
    console.log('🧹 Starting log cleanup...');
    console.log('Connecting to MongoDB...');

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        // Import models
        const { EmailLog } = await import('../models/EmailLog');
        const { AuditLog } = await import('../models/AuditLog');
        const { EmailQueue } = await import('../models/EmailQueue');
        const { EmailEvent } = await import('../models/EmailEvent');
        const { CycleRestorePoint } = await import('../models/CycleRestorePoint');

        // Cleanup EmailLog
        const emailLogResult = await EmailLog.deleteMany({});
        console.log(`  📧 Deleted ${emailLogResult.deletedCount} email logs`);

        // Cleanup AuditLog
        const auditLogResult = await AuditLog.deleteMany({});
        console.log(`  📋 Deleted ${auditLogResult.deletedCount} audit logs`);

        // Cleanup EmailQueue
        const emailQueueResult = await EmailQueue.deleteMany({});
        console.log(`  📬 Deleted ${emailQueueResult.deletedCount} email queue items`);

        // Cleanup EmailEvent
        const emailEventResult = await EmailEvent.deleteMany({});
        console.log(`  📨 Deleted ${emailEventResult.deletedCount} email events`);

        // Cleanup CycleRestorePoint
        const restorePointResult = await CycleRestorePoint.deleteMany({});
        console.log(`  🔄 Deleted ${restorePointResult.deletedCount} cycle restore points`);

        console.log('\n✅ Log cleanup complete!');

        const totalDeleted =
            emailLogResult.deletedCount +
            auditLogResult.deletedCount +
            emailQueueResult.deletedCount +
            emailEventResult.deletedCount +
            restorePointResult.deletedCount;

        console.log(`📊 Total records deleted: ${totalDeleted}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

cleanupLogs();
