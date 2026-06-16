import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

type DatabaseExport = Record<string, unknown[]>;

const DEFAULT_COLLECTIONS = [
    'companies',
    'evaluationconfigs',
    'users',
    'cycles',
    'processes',
    'emailconfigs',
    'emailqueues',
    'emaillogs',
    'emailevents',
    'auditlogs',
    'networkdevices',
    'cyclerestorepoints',
];

const OBJECT_ID_KEYS = new Set([
    '_id',
    'companyId',
    'cycleId',
    'managerId',
    'actorUserId',
    'entityId',
    'queueId',
    'createdByUserId',
    'responsibleUserId',
    'createdBy',
    'revertedBy',
    'activeCompanyId',
]);

const DATE_KEYS = new Set([
    'plannedDate',
    'limitDate',
    'deliveryDate',
    'openedAt',
    'closedAt',
    'createdAt',
    'updatedAt',
    'sentAt',
    'emailSentAt',
    'revertedAt',
    'emailVerificationExpires',
    'resetPasswordExpires',
]);

function getArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
    return process.argv.includes(`--${name}`);
}

function isObjectIdString(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

function isIsoDateString(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function hydrateMongoTypes(value: unknown, key?: string): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => hydrateMongoTypes(item));
    }

    if (!value || typeof value !== 'object') {
        if (key && OBJECT_ID_KEYS.has(key) && isObjectIdString(value)) {
            return new mongoose.Types.ObjectId(value);
        }

        if (key && DATE_KEYS.has(key) && isIsoDateString(value)) {
            return new Date(value);
        }

        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
            childKey,
            hydrateMongoTypes(childValue, childKey),
        ])
    );
}

async function main(): Promise<void> {
    const exportPath = path.resolve(
        process.cwd(),
        getArg('export') || '../db_export/_FULL_DATABASE.json'
    );
    const mongoUri = getArg('uri') || process.env.MONGODB_URI || 'mongodb://localhost:27017/MMdb';
    const backupDir = path.resolve(process.cwd(), getArg('backup-dir') || '../backups');
    const dryRun = hasFlag('dry-run') || !hasFlag('apply');

    if (!fs.existsSync(exportPath)) {
        throw new Error(`Export file not found: ${exportPath}`);
    }

    const parsed = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as DatabaseExport;
    const collections = DEFAULT_COLLECTIONS.filter((name) => Array.isArray(parsed[name]));

    console.log(`Export: ${exportPath}`);
    console.log(`MongoDB: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
    console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);

    for (const name of collections) {
        console.log(`  ${name}: ${parsed[name].length} documents`);
    }

    if (dryRun) {
        console.log('Dry run only. Re-run with --apply to replace the target collections.');
        return;
    }

    fs.mkdirSync(backupDir, { recursive: true });

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;

    if (!db) {
        throw new Error('MongoDB connection did not expose a database handle.');
    }

    const backup: DatabaseExport = {};

    for (const name of collections) {
        backup[name] = await db.collection(name).find({}).toArray();
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `pre_restore_${stamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`Backup written: ${backupPath}`);

    for (const name of collections) {
        const docs = parsed[name].map((doc) => hydrateMongoTypes(doc)) as Record<string, unknown>[];
        await db.collection(name).deleteMany({});

        if (docs.length > 0) {
            await db.collection(name).insertMany(docs, { ordered: true });
        }

        console.log(`Restored ${name}: ${docs.length} documents`);
    }

    await mongoose.disconnect();
    console.log('Restore complete.');
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
