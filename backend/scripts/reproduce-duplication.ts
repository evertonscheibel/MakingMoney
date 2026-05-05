
import mongoose from 'mongoose';
import { Company, Cycle, Process, User, EvaluationConfig } from '../src/models';
import { closeCycle, reopenCycle, openCycle } from '../src/controllers/cycle.controller';
import { Request, Response } from 'express';
import { CycleStatus, ProcessStatus, UserRole } from '../src/types';

const MONGODB_URI = 'mongodb://localhost:27017/makingMoney';

async function connectDB() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
    }
}

async function mockRequest(user: any, body: any = {}, params: any = {}, query: any = {}) {
    return {
        user,
        body,
        params,
        query,
        companyId: user.activeCompanyId,
    } as unknown as Request;
}

async function mockResponse() {
    const res: any = {};
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        res.data = data;
        return res;
    };
    return res as Response;
}

async function run() {
    await connectDB();

    try {
        console.log('--- Starting Reproduction Script ---');

        // 1. Setup Data
        // Find or create a test company and user
        let user = await User.findOne({ email: 'admin@repro.com' });
        if (!user) {
            const company = await Company.create({
                name: 'Reproduction Company',
                document: '12345678901234',
                sectors: [{ name: 'Test Sector', managerId: null }]
            });
            user = await User.create({
                name: 'Admin Repro',
                email: 'admin@repro.com',
                passwordHash: '$2a$12$R.S.Y.Z.1.2.3.4.5.6.7.8.9.0.1', // Dummy hash
                roles: [UserRole.MASTER],
                companyAccess: [{ companyId: company._id, role: UserRole.MASTER, status: 'ACTIVE' }],
                activeCompanyId: company._id
            });
            console.log('Created test company and user');
        } else {
            // Clean up previous run
            console.log('Cleaning up previous run data...');
            await Cycle.deleteMany({ companyId: user.activeCompanyId });
            await Process.deleteMany({ companyId: user.activeCompanyId });
        }

        const companyId = user.activeCompanyId;

        // 2. Open Cycle A (Jan 2025)
        console.log('--- Opening Cycle A (2025-01) ---');
        await Cycle.create({
            companyId,
            month: '2025-01',
            status: CycleStatus.OPEN
        });
        const cycleA = await Cycle.findOne({ companyId, month: '2025-01' });

        // Create 38 processes
        const processes = [];
        for (let i = 1; i <= 38; i++) {
            processes.push({
                companyId,
                cycleId: cycleA!._id,
                code: i.toString().padStart(3, '0'),
                title: `Process ${i}`,
                sector: 'Test Sector',
                plannedDate: new Date('2025-01-15'),
                limitDate: new Date('2025-01-20'),
                status: ProcessStatus.PENDING
            });
        }
        await Process.insertMany(processes);
        console.log(`Created ${processes.length} processes in Cycle A`);

        // 3. Close Cycle A
        console.log('--- Closing Cycle A ---');
        const reqClose = await mockRequest(user, { openNext: true });
        const resClose = await mockResponse();

        // We need to bypass the actual controller if it uses imports that might fail in this script context 
        // (e.g. email service). But let's try calling it directly first.
        // Note: The controller imports '../models' which we have.
        // It imports email service, which might try to connect to something. We might need to mock it.
        // For now, let's just see if it runs.

        // Just calling logic similar to controller to avoid extensive mocking of services
        const cycle = cycleA!;
        cycle.status = CycleStatus.CLOSED;
        await cycle.save();

        const nextMonth = '2025-02';
        const nextCycle = await Cycle.create({
            companyId,
            month: nextMonth,
            status: CycleStatus.OPEN
        });

        // Clone processes
        const activeProcesses = await Process.find({ cycleId: cycle._id });
        const cloned = activeProcesses.map(p => ({
            companyId,
            cycleId: nextCycle._id,
            code: p.code,
            title: p.title,
            sector: p.sector,
            plannedDate: new Date('2025-02-15'),
            limitDate: new Date('2025-02-20'),
            status: ProcessStatus.PENDING
        }));
        await Process.insertMany(cloned);
        console.log(`Cycle A closed. Cycle B (${nextMonth}) created with ${cloned.length} processes.`);

        // 4. User Reopens Cycle A
        // Prerequisite: Cycle B must be deleted or closed.
        // User likely deletes Cycle B? 
        console.log('--- Simulating User deleting Cycle B to reopen A ---');
        await Cycle.deleteOne({ _id: nextCycle._id });
        // NOTE: Does the user delete the PROCESSES of Cycle B?
        // If they don't, they are just orphaned.
        // Let's assume they DON'T delete processes.

        console.log('--- Reopening Cycle A ---');
        cycle.status = CycleStatus.OPEN;
        await cycle.save();
        console.log('Cycle A reopened.');

        // 5. User Closes Cycle A AGAIN
        console.log('--- Closing Cycle A Again ---');

        // Controller Logic again
        cycle.status = CycleStatus.CLOSED;
        await cycle.save();

        const nextCycle2 = await Cycle.create({
            companyId,
            month: nextMonth, // '2025-02'
            status: CycleStatus.OPEN
        });

        const activeProcesses2 = await Process.find({ cycleId: cycle._id });
        const cloned2 = activeProcesses2.map(p => ({
            companyId,
            cycleId: nextCycle2._id, // process linked to NEW cycle id
            code: p.code,
            title: p.title,
            sector: p.sector,
            plannedDate: new Date('2025-02-15'),
            limitDate: new Date('2025-02-20'),
            status: ProcessStatus.PENDING
        }));
        await Process.insertMany(cloned2);
        console.log(`Cycle A closed again. Cycle B (2nd attempt) created with ${cloned2.length} processes.`);

        // 6. Check for duplication
        // Count processes in Cycle A
        const countA = await Process.countDocuments({ cycleId: cycle._id });
        console.log(`Count in Cycle A: ${countA} (Expected 38)`);

        // Count processes in new Cycle B
        const countB = await Process.countDocuments({ cycleId: nextCycle2._id });
        console.log(`Count in Cycle B (new): ${countB} (Expected 38)`);

        // Count TOTAL processes for Company
        const total = await Process.countDocuments({ companyId });
        console.log(`Total Processes: ${total} (38 A + 38 Orphaned B1 + 38 B2 = 114)`);

        // The user says "passes to 76". 
        // If they are looking at a list that filters by CYCLE, they should see 38.
        // If they looking at a list that filters by MONTH... but processes have cycleId.

        // WHAT IF: The user *Restores* the cycle?
        // Let's try to simulate Restore.

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();

