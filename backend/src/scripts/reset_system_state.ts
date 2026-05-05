/**
 * Script to reset system state to initial conditions
 * 
 * What gets RESET:
 * - All process delivery statuses -> NOT_DELIVERED
 * - All process scores -> null
 * - All process statuses -> PENDING
 * - All delivery dates -> null
 * - January 2026 cycle reopened (others closed)
 * 
 * What is PRESERVED:
 * - Process definitions (code, title, sector, planned/limit dates)
 * - Users and permissions
 * - Companies and configurations
 * - Evaluation and email settings
 * 
 * Usage: npx ts-node src/scripts/reset_system_state.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function resetSystemState() {
    console.log('🔄 Starting system state reset...');
    console.log('Connecting to MongoDB...');

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        // Import models
        const { Process } = await import('../models/Process');
        const { Cycle } = await import('../models/Cycle');
        const { Company } = await import('../models/Company');
        const { DeliveryStatus, ProcessStatus, CycleStatus } = await import('../types');

        const companies = await Company.find({});
        console.log(`\nFound ${companies.length} companies to process.`);

        for (const company of companies) {
            console.log(`\n📁 Processing company: ${company.name}`);

            // 1. Reset all processes for this company
            const processResult = await Process.updateMany(
                { companyId: company._id },
                {
                    $set: {
                        status: ProcessStatus.PENDING,
                        deliveryStatus: DeliveryStatus.NOT_DELIVERED,
                        deliveryDate: null,
                        deliverySource: null,
                        deliveryEvidence: null,
                        score: null,
                        emailSentAt: null,
                        revertReason: null,
                        revertedBy: null,
                        revertedAt: null,
                    }
                }
            );
            console.log(`  📄 Reset ${processResult.modifiedCount} processes to PENDING state`);

            // 2. Find or create January 2026 cycle for each sector
            const sectors = company.sectors?.map((s: any) => typeof s === 'string' ? s : s.name) || [];

            for (const sectorName of sectors) {
                // Find existing January 2026 cycle for this sector
                let janCycle = await Cycle.findOne({
                    companyId: company._id,
                    sector: sectorName,
                    month: '2026-01'
                });

                if (!janCycle) {
                    // Create January 2026 cycle if it doesn't exist
                    janCycle = await Cycle.create({
                        companyId: company._id,
                        sector: sectorName,
                        month: '2026-01',
                        status: CycleStatus.OPEN,
                        openedAt: new Date('2026-01-01T00:00:00Z'),
                        kpis: {
                            avgScore: 0,
                            onTimePct: 0,
                            criticalCount: 0,
                            totalProcesses: 0,
                            avgDeviationDays: 0
                        }
                    });
                    console.log(`  📅 Created January 2026 cycle for sector: ${sectorName}`);
                } else {
                    // Reopen existing January cycle
                    janCycle.status = CycleStatus.OPEN;
                    janCycle.closedAt = null;
                    janCycle.kpis = {
                        avgScore: 0,
                        onTimePct: 0,
                        criticalCount: 0,
                        totalProcesses: 0,
                        avgDeviationDays: 0
                    };
                    await janCycle.save();
                    console.log(`  📅 Reopened January 2026 cycle for sector: ${sectorName}`);
                }

                // Move all processes of this sector to January cycle
                const moveResult = await Process.updateMany(
                    { companyId: company._id, sector: sectorName },
                    { $set: { cycleId: janCycle._id } }
                );
                console.log(`  ➡️  Moved ${moveResult.modifiedCount} processes to January 2026 cycle (${sectorName})`);

                // Close other cycles for this sector
                const closeResult = await Cycle.updateMany(
                    {
                        companyId: company._id,
                        sector: sectorName,
                        _id: { $ne: janCycle._id }
                    },
                    { $set: { status: CycleStatus.CLOSED } }
                );
                if (closeResult.modifiedCount > 0) {
                    console.log(`  🔒 Closed ${closeResult.modifiedCount} other cycles for sector: ${sectorName}`);
                }
            }
        }

        console.log('\n✅ System state reset complete!');
        console.log('\n📋 Summary:');
        console.log('  - All processes reset to PENDING status');
        console.log('  - All delivery information cleared');
        console.log('  - All scores reset to null');
        console.log('  - January 2026 cycles opened for all sectors');
        console.log('  - Other cycles closed');
        console.log('\n💡 The system is ready for a fresh start!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Reset failed:', error);
        process.exit(1);
    }
}

resetSystemState();
