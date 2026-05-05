/**
 * Seed script: Migrate company sectors + create test data for bonus testing.
 *
 * What this script does:
 * 1. Fixes old string-based sectors to the new { name, managerId } format
 * 2. Creates operator users with baseSalary and sector
 * 3. Creates cycles for the current month (one per sector)
 * 4. Creates delivered processes with scores so bonus reports can be tested
 *
 * Run: npx ts-node scripts/seed_bonus_test.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MMdb';

async function run() {
    console.log('🔗 Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db!;

    // ======================================================
    // 1. FIX COMPANY SECTORS (string → { name, managerId })
    // ======================================================
    console.log('🔧 Step 1: Fixing company sectors format...');

    const companiesCol = db.collection('companies');
    const companies = await companiesCol.find({ isActive: true }).toArray();

    for (const company of companies) {
        const needsFix = company.sectors?.some((s: any) => typeof s === 'string');
        if (needsFix) {
            const fixed = company.sectors.map((s: any) => {
                if (typeof s === 'string') {
                    return { _id: new mongoose.Types.ObjectId(), name: s, managerId: null };
                }
                return s;
            });
            await companiesCol.updateOne(
                { _id: company._id },
                { $set: { sectors: fixed } }
            );
            console.log(`   ✅ Fixed sectors for "${company.name}": ${fixed.map((s: any) => s.name).join(', ')}`);
        } else {
            console.log(`   ⏭️  "${company.name}" sectors already in correct format`);
        }
    }

    // Use the first active company
    const targetCompany = companies[0];
    if (!targetCompany) {
        console.error('❌ No active company found!');
        process.exit(1);
    }
    const companyId = targetCompany._id;
    console.log(`\n🏢 Target company: "${targetCompany.name}" (${companyId})`);

    // Reload sectors after fix
    const updatedCompany = await companiesCol.findOne({ _id: companyId });
    const sectorNames: string[] = (updatedCompany!.sectors || []).map((s: any) => s.name || s);

    // Add more sectors if needed for testing
    const testSectors = ['Controladoria', 'Fiscal/Contabil', 'RH', 'TI', 'Comercial'];
    for (const sName of testSectors) {
        if (!sectorNames.includes(sName)) {
            await companiesCol.updateOne(
                { _id: companyId },
                { $push: { sectors: { _id: new mongoose.Types.ObjectId(), name: sName, managerId: null } as any } }
            );
            sectorNames.push(sName);
            console.log(`   ➕ Added sector: ${sName}`);
        }
    }
    console.log(`   📋 Final sectors: ${sectorNames.join(', ')}`);

    // ======================================================
    // 2. CREATE OPERATOR USERS
    // ======================================================
    console.log('\n👤 Step 2: Creating operator users...');

    const usersCol = db.collection('users');
    const passwordHash = await bcrypt.hash('operador123', 12);

    const operators = [
        { name: 'Ana Costa', email: 'ana@gestaopro.com', sector: 'RH', baseSalary: 4500 },
        { name: 'Carlos Oliveira', email: 'carlos@gestaopro.com', sector: 'TI', baseSalary: 6000 },
        { name: 'Fernanda Rocha', email: 'fernanda@gestaopro.com', sector: 'Comercial', baseSalary: 3800 },
        { name: 'João Silva', email: 'joao@gestaopro.com', sector: 'Controladoria', baseSalary: 5200 },
        { name: 'Maria Santos', email: 'maria@gestaopro.com', sector: 'Fiscal/Contabil', baseSalary: 4800 },
    ];

    const createdUserIds: { [email: string]: mongoose.Types.ObjectId } = {};

    for (const op of operators) {
        const existing = await usersCol.findOne({ email: op.email });
        if (existing) {
            // Update existing user with sector and baseSalary
            await usersCol.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        sector: op.sector,
                        sectors: [op.sector],
                        baseSalary: op.baseSalary,
                        roles: ['operator'],
                    },
                    $addToSet: {
                        companyAccess: { companyId, role: 'operator' }
                    }
                }
            );
            createdUserIds[op.email] = existing._id;
            console.log(`   ⬆️  Updated: ${op.name} (${op.email}) - ${op.sector} - R$${op.baseSalary}`);
        } else {
            const userId = new mongoose.Types.ObjectId();
            await usersCol.insertOne({
                _id: userId,
                name: op.name,
                email: op.email,
                passwordHash,
                roles: ['operator'],
                companyAccess: [{ companyId, role: 'operator' }],
                activeCompanyId: companyId,
                isEmailVerified: true,
                allowedMenus: ['dashboard', 'processes', 'reports', 'bonus-report'],
                sector: op.sector,
                sectors: [op.sector],
                baseSalary: op.baseSalary,
                position: 'Analista',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);
            createdUserIds[op.email] = userId;
            console.log(`   ✅ Created: ${op.name} (${op.email}) - ${op.sector} - R$${op.baseSalary}`);
        }
    }

    // Also update existing admin/gerente/operador users with baseSalary
    await usersCol.updateOne(
        { email: 'admin@gestaopro.com' },
        { $set: { baseSalary: 12000, sector: 'Controladoria', sectors: sectorNames } }
    );
    await usersCol.updateOne(
        { email: 'gerente@gestaopro.com' },
        { $set: { baseSalary: 8000, sector: 'Controladoria', sectors: sectorNames } }
    );
    await usersCol.updateOne(
        { email: 'operador@gestaopro.com' },
        { $set: { baseSalary: 3500, sector: 'Controladoria', sectors: ['Controladoria'] } }
    );

    // ======================================================
    // 3. CREATE CYCLES FOR CURRENT MONTH (one per sector)
    // ======================================================
    console.log('\n📅 Step 3: Creating cycles for current month...');

    const cyclesCol = db.collection('cycles');
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const cycleIds: { [sector: string]: mongoose.Types.ObjectId } = {};

    for (const sector of sectorNames) {
        const existing = await cyclesCol.findOne({ companyId, month: currentMonth, sector });
        if (existing) {
            cycleIds[sector] = existing._id;
            console.log(`   ⏭️  Cycle ${currentMonth} / ${sector} already exists`);
        } else {
            const cycleId = new mongoose.Types.ObjectId();
            await cyclesCol.insertOne({
                _id: cycleId,
                companyId,
                month: currentMonth,
                sector,
                status: 'OPEN',
                openedAt: new Date(),
                closedAt: null,
                kpis: { avgScore: 0, onTimePct: 0, criticalCount: 0, totalProcesses: 0, avgDeviationDays: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);
            cycleIds[sector] = cycleId;
            console.log(`   ✅ Created cycle: ${currentMonth} / ${sector}`);
        }
    }

    // ======================================================
    // 4. CREATE PROCESSES WITH VARIED SCORES
    // ======================================================
    console.log('\n📋 Step 4: Creating processes with delivery scores...');

    const processesCol = db.collection('processes');

    // Map operator to their sector
    const operatorBySector: { [sector: string]: mongoose.Types.ObjectId } = {};
    for (const op of operators) {
        operatorBySector[op.sector] = createdUserIds[op.email];
    }

    // Also add existing operador user
    const existingOp = await usersCol.findOne({ email: 'operador@gestaopro.com' });
    if (existingOp) {
        operatorBySector['Controladoria'] = existingOp._id;
    }

    // Process templates per sector
    const processTemplates: { sector: string; processes: { code: string; title: string; score: number; status: string; daysOffset: number }[] }[] = [
        {
            sector: 'Controladoria',
            processes: [
                { code: '101', title: 'Fechamento Contábil Mensal', score: 95, status: 'ON_TIME', daysOffset: -5 },
                { code: '102', title: 'Conciliação Bancária', score: 88, status: 'ON_TIME', daysOffset: -3 },
                { code: '103', title: 'DRE Mensal', score: 75, status: 'LATE', daysOffset: 2 },
                { code: '104', title: 'Balanço Patrimonial', score: 100, status: 'ON_TIME', daysOffset: -7 },
                { code: '105', title: 'Fluxo de Caixa', score: 60, status: 'CRITICAL', daysOffset: 5 },
            ]
        },
        {
            sector: 'Fiscal/Contabil',
            processes: [
                { code: '201', title: 'Apuração ICMS', score: 92, status: 'ON_TIME', daysOffset: -4 },
                { code: '202', title: 'Escrituração Fiscal', score: 85, status: 'ON_TIME', daysOffset: -2 },
                { code: '203', title: 'SPED Contribuições', score: 78, status: 'LATE', daysOffset: 1 },
                { code: '204', title: 'Declaração IR', score: 100, status: 'ON_TIME', daysOffset: -6 },
                { code: '205', title: 'Obrigações Acessórias', score: 50, status: 'CRITICAL', daysOffset: 8 },
            ]
        },
        {
            sector: 'RH',
            processes: [
                { code: '301', title: 'Processamento de Folha', score: 97, status: 'ON_TIME', daysOffset: -6 },
                { code: '302', title: 'Atualização de Benefícios', score: 90, status: 'ON_TIME', daysOffset: -3 },
                { code: '303', title: 'Controle de Ponto', score: 82, status: 'ON_TIME', daysOffset: -1 },
                { code: '304', title: 'Admissões e Demissões', score: 70, status: 'LATE', daysOffset: 3 },
            ]
        },
        {
            sector: 'TI',
            processes: [
                { code: '401', title: 'Backup de Sistemas', score: 100, status: 'ON_TIME', daysOffset: -7 },
                { code: '402', title: 'Atualização de Servidores', score: 93, status: 'ON_TIME', daysOffset: -4 },
                { code: '403', title: 'Monitoramento de Rede', score: 88, status: 'ON_TIME', daysOffset: -2 },
                { code: '404', title: 'Patch de Segurança', score: 65, status: 'LATE', daysOffset: 4 },
            ]
        },
        {
            sector: 'Comercial',
            processes: [
                { code: '501', title: 'Relatório de Vendas', score: 96, status: 'ON_TIME', daysOffset: -5 },
                { code: '502', title: 'Análise de Metas', score: 84, status: 'ON_TIME', daysOffset: -2 },
                { code: '503', title: 'Pipeline de Propostas', score: 72, status: 'LATE', daysOffset: 2 },
                { code: '504', title: 'Atualização CRM', score: 91, status: 'ON_TIME', daysOffset: -3 },
            ]
        },
    ];

    let totalCreated = 0;

    for (const template of processTemplates) {
        const cycleId = cycleIds[template.sector];
        if (!cycleId) {
            console.log(`   ⚠️  No cycle for sector "${template.sector}", skipping`);
            continue;
        }

        const responsibleUserId = operatorBySector[template.sector] || null;

        for (const proc of template.processes) {
            // Check if process already exists
            const existing = await processesCol.findOne({
                companyId,
                cycleId,
                sector: template.sector,
                code: proc.code,
            });

            if (existing) {
                console.log(`   ⏭️  Process ${proc.code} already exists in ${template.sector}`);
                continue;
            }

            const plannedDate = new Date(now);
            plannedDate.setDate(plannedDate.getDate() - 15); // Mid-month planned

            const limitDate = new Date(now);
            limitDate.setDate(limitDate.getDate() - 5); // A few days ago as limit

            const deliveryDate = new Date(limitDate);
            deliveryDate.setDate(deliveryDate.getDate() + proc.daysOffset);

            await processesCol.insertOne({
                _id: new mongoose.Types.ObjectId(),
                companyId,
                cycleId,
                code: proc.code,
                title: proc.title,
                sector: template.sector,
                owner: null,
                plannedDate,
                limitDate,
                deliveryDate,
                deliverySource: 'MANUAL',
                deliveryEvidence: 'Entrega de teste para validação de bonificação',
                score: proc.score,
                status: proc.status,
                responsibleUserId,
                deliveryStatus: 'EMAIL_SENT',
                emailSentAt: null,
                revertReason: null,
                revertedBy: null,
                revertedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);

            totalCreated++;
        }
        console.log(`   ✅ ${template.sector}: ${template.processes.length} processes`);
    }

    // ======================================================
    // SUMMARY
    // ======================================================
    console.log('\n' + '='.repeat(50));
    console.log('✨ Seed completed successfully!');
    console.log('='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Company: ${targetCompany.name}`);
    console.log(`   Sectors: ${sectorNames.length}`);
    console.log(`   Operators: ${operators.length}`);
    console.log(`   Cycles: ${Object.keys(cycleIds).length}`);
    console.log(`   Processes created: ${totalCreated}`);
    console.log(`\n🔑 Test Login Credentials:`);
    console.log(`   Admin:     admin@gestaopro.com / admin123`);
    console.log(`   Gerente:   gerente@gestaopro.com / manager123`);
    for (const op of operators) {
        console.log(`   ${op.name.padEnd(12)}: ${op.email} / operador123 (R$${op.baseSalary})`);
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
