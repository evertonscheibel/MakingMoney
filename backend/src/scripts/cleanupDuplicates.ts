import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/makingmoney';

interface ProcessDoc {
    _id: mongoose.Types.ObjectId;
    companyId: mongoose.Types.ObjectId;
    cycleId: mongoose.Types.ObjectId;
    code: string;
    title: string;
    sector: string;
    createdAt: Date;
}

async function main() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const Process = mongoose.connection.collection('processes');

    // Step 1: Diagnose duplicates
    console.log('\n=== DIAGNOSTIC: Finding Duplicates ===\n');

    const duplicates = await Process.aggregate([
        {
            $group: {
                _id: { companyId: '$companyId', sector: '$sector', code: '$code' },
                count: { $sum: 1 },
                docs: { $push: { _id: '$_id', cycleId: '$cycleId', title: '$title', createdAt: '$createdAt' } }
            }
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } }
    ]).toArray();

    if (duplicates.length === 0) {
        console.log('✅ No duplicates found! Database is clean.');
        await mongoose.disconnect();
        return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate groups:\n`);

    let totalToDelete = 0;
    const idsToDelete: mongoose.Types.ObjectId[] = [];

    for (const dup of duplicates) {
        console.log(`Code: ${dup._id.code} | Sector: ${dup._id.sector} | Count: ${dup.count}`);

        // Sort by createdAt ascending (oldest first)
        const sorted = dup.docs.sort((a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Keep the first one (oldest), delete the rest
        const toKeep = sorted[0];
        const toDelete = sorted.slice(1);

        console.log(`  ✓ Keeping: ${toKeep._id} (created: ${toKeep.createdAt})`);
        for (const del of toDelete) {
            console.log(`  ✗ Will delete: ${del._id} (created: ${del.createdAt})`);
            idsToDelete.push(del._id);
        }
        totalToDelete += toDelete.length;
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total duplicate groups: ${duplicates.length}`);
    console.log(`Total processes to delete: ${totalToDelete}`);

    // Step 2: Delete duplicates
    if (idsToDelete.length > 0) {
        console.log('\n=== CLEANUP: Deleting Duplicates ===\n');

        const result = await Process.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`✅ Deleted ${result.deletedCount} duplicate processes.`);
    }

    await mongoose.disconnect();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

