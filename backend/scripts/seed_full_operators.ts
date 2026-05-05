/**
 * Seed: 10+ operadores por setor com salários diversos.
 * Alguns setores ficam ABAIXO de 75% para testar o bloqueio de bônus.
 *
 * Run: npx ts-node scripts/seed_full_operators.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MMdb';

// ── Operator definitions per sector ──
const SECTOR_DATA: {
    sector: string;
    // targetAvg controls whether sector qualifies (>= 75) or not
    targetAvg: 'high' | 'medium' | 'low';
    operators: { name: string; salary: number }[];
}[] = [
    {
        sector: 'Controladoria',
        targetAvg: 'high', // ~85-95% → qualificado
        operators: [
            { name: 'João Silva', salary: 5200 },
            { name: 'Roberto Almeida', salary: 4800 },
            { name: 'Patrícia Mendes', salary: 6100 },
            { name: 'André Carvalho', salary: 3900 },
            { name: 'Luciana Ferreira', salary: 5500 },
            { name: 'Eduardo Martins', salary: 4200 },
            { name: 'Daniela Costa', salary: 7200 },
            { name: 'Marcos Pereira', salary: 3600 },
            { name: 'Camila Rodrigues', salary: 5800 },
            { name: 'Fernando Souza', salary: 4500 },
            { name: 'Adriana Barbosa', salary: 6500 },
            { name: 'Gustavo Lima', salary: 3200 },
        ],
    },
    {
        sector: 'Fiscal/Contabil',
        targetAvg: 'medium', // ~76-82% → qualificado mas apertado
        operators: [
            { name: 'Maria Santos', salary: 4800 },
            { name: 'Carolina Dias', salary: 5100 },
            { name: 'Ricardo Nunes', salary: 3700 },
            { name: 'Tatiana Oliveira', salary: 6300 },
            { name: 'Bruno Machado', salary: 4100 },
            { name: 'Vanessa Ribeiro', salary: 5600 },
            { name: 'Paulo Henrique', salary: 3400 },
            { name: 'Renata Moreira', salary: 4900 },
            { name: 'Sérgio Campos', salary: 5300 },
            { name: 'Aline Teixeira', salary: 4000 },
        ],
    },
    {
        sector: 'RH',
        targetAvg: 'low', // ~60-72% → NÃO qualificado
        operators: [
            { name: 'Ana Costa', salary: 4500 },
            { name: 'Cláudia Moura', salary: 3800 },
            { name: 'Diego Nascimento', salary: 5200 },
            { name: 'Elaine Araújo', salary: 4100 },
            { name: 'Fábio Correia', salary: 6000 },
            { name: 'Gisele Pinto', salary: 3500 },
            { name: 'Henrique Lopes', salary: 4700 },
            { name: 'Isabela Castro', salary: 3900 },
            { name: 'Jorge Freitas', salary: 5400 },
            { name: 'Karen Vieira', salary: 4300 },
        ],
    },
    {
        sector: 'TI',
        targetAvg: 'high', // ~88-96% → qualificado
        operators: [
            { name: 'Carlos Oliveira', salary: 6000 },
            { name: 'Leandro Melo', salary: 7500 },
            { name: 'Mariana Rocha', salary: 5800 },
            { name: 'Thiago Cardoso', salary: 8200 },
            { name: 'Juliana Santana', salary: 6500 },
            { name: 'Rafael Gomes', salary: 7000 },
            { name: 'Priscila Duarte', salary: 5200 },
            { name: 'Leonardo Monteiro', salary: 9000 },
            { name: 'Amanda Fonseca', salary: 6800 },
            { name: 'Vinícius Souza', salary: 5500 },
            { name: 'Natália Borges', salary: 7200 },
        ],
    },
    {
        sector: 'Comercial',
        targetAvg: 'low', // ~55-70% → NÃO qualificado
        operators: [
            { name: 'Fernanda Rocha', salary: 3800 },
            { name: 'Márcio Andrade', salary: 4200 },
            { name: 'Simone Barros', salary: 3500 },
            { name: 'Alexandre Reis', salary: 5100 },
            { name: 'Débora Cunha', salary: 3900 },
            { name: 'Rodrigo Leal', salary: 4600 },
            { name: 'Viviane Azevedo', salary: 3300 },
            { name: 'Tiago Medeiros', salary: 5500 },
            { name: 'Monique Saraiva', salary: 4000 },
            { name: 'Filipe Tavares', salary: 4800 },
        ],
    },
];

// ── Score generators based on target avg ──
function generateScores(target: 'high' | 'medium' | 'low', count: number): number[] {
    const ranges: Record<string, [number, number]> = {
        high: [80, 100],    // avg ~90
        medium: [65, 88],   // avg ~76
        low: [40, 78],      // avg ~60
    };
    const [min, max] = ranges[target];
    const scores: number[] = [];
    for (let i = 0; i < count; i++) {
        scores.push(Math.round(min + Math.random() * (max - min)));
    }
    return scores;
}

function statusForScore(score: number): string {
    if (score >= 80) return 'ON_TIME';
    if (score >= 50) return 'LATE';
    return 'CRITICAL';
}

async function run() {
    console.log('🔗 Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    const db = mongoose.connection.db!;
    const usersCol = db.collection('users');
    const processesCol = db.collection('processes');
    const cyclesCol = db.collection('cycles');
    const companiesCol = db.collection('companies');

    // Get target company
    const company = await companiesCol.findOne({ isActive: true });
    if (!company) { console.error('❌ No active company!'); process.exit(1); }
    const companyId = company._id;
    console.log(`🏢 Company: "${company.name}" (${companyId})`);

    // Current quarter months
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const qStart = currentMonth <= 3 ? 1 : currentMonth <= 6 ? 4 : currentMonth <= 9 ? 7 : 10;
    const quarterMonths = [qStart, qStart + 1, qStart + 2];
    const year = now.getFullYear();
    console.log(`📅 Quarter months: ${quarterMonths.map(m => `${year}-${String(m).padStart(2, '0')}`).join(', ')}\n`);

    const passwordHash = await bcrypt.hash('operador123', 12);

    // Process templates (4-6 per operator per month)
    const processTemplates = [
        'Relatório Mensal', 'Conciliação', 'Fechamento', 'Análise de Dados',
        'Auditoria Interna', 'Revisão de Documentos', 'Atualização de Sistema',
        'Controle de Qualidade', 'Validação de Registros', 'Checagem de Compliance',
    ];

    let totalOperators = 0;
    let totalProcesses = 0;

    for (const sectorData of SECTOR_DATA) {
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`📂 Setor: ${sectorData.sector} (target: ${sectorData.targetAvg})`);

        // Ensure cycles exist for each month in the quarter
        const cycleIds: mongoose.Types.ObjectId[] = [];
        for (const m of quarterMonths) {
            const monthStr = `${year}-${String(m).padStart(2, '0')}`;
            let cycle = await cyclesCol.findOne({ companyId, month: monthStr, sector: sectorData.sector });
            if (!cycle) {
                const id = new mongoose.Types.ObjectId();
                await cyclesCol.insertOne({
                    _id: id,
                    companyId,
                    month: monthStr,
                    sector: sectorData.sector,
                    status: 'OPEN',
                    openedAt: new Date(),
                    closedAt: null,
                    kpis: { avgScore: 0, onTimePct: 0, criticalCount: 0, totalProcesses: 0, avgDeviationDays: 0 },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any);
                cycle = { _id: id };
                console.log(`   📅 Created cycle: ${monthStr}`);
            }
            cycleIds.push(cycle._id);
        }

        for (const op of sectorData.operators) {
            // Generate unique email
            const emailBase = op.name
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '.')
                .replace(/[^a-z.]/g, '');
            const email = `${emailBase}@gestaopro.com`;

            // Upsert user
            let user = await usersCol.findOne({ email });
            let userId: mongoose.Types.ObjectId;

            if (user) {
                userId = user._id;
                await usersCol.updateOne({ _id: userId }, {
                    $set: {
                        name: op.name,
                        sector: sectorData.sector,
                        sectors: [sectorData.sector],
                        baseSalary: op.salary,
                        roles: ['operator'],
                        allowedMenus: ['dashboard', 'processes', 'reports', 'bonus-report'],
                    },
                    $addToSet: { companyAccess: { companyId, role: 'operator' } }
                });
            } else {
                userId = new mongoose.Types.ObjectId();
                await usersCol.insertOne({
                    _id: userId,
                    name: op.name,
                    email,
                    passwordHash,
                    roles: ['operator'],
                    companyAccess: [{ companyId, role: 'operator' }],
                    activeCompanyId: companyId,
                    isEmailVerified: true,
                    allowedMenus: ['dashboard', 'processes', 'reports', 'bonus-report'],
                    sector: sectorData.sector,
                    sectors: [sectorData.sector],
                    baseSalary: op.salary,
                    position: 'Analista',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any);
            }

            totalOperators++;

            // Create processes for each month in the quarter (4-5 per month)
            for (let mi = 0; mi < quarterMonths.length; mi++) {
                const month = quarterMonths[mi];
                const cycleId = cycleIds[mi];
                const monthStr = `${year}-${String(month).padStart(2, '0')}`;
                const processCount = 4 + Math.floor(Math.random() * 2); // 4 or 5
                const scores = generateScores(sectorData.targetAvg, processCount);

                for (let pi = 0; pi < processCount; pi++) {
                    const code = `${String(SECTOR_DATA.indexOf(sectorData) + 1)}${String(sectorData.operators.indexOf(op) + 1).padStart(2, '0')}${pi + 1}`;

                    // Check if exists
                    const exists = await processesCol.findOne({ companyId, cycleId, sector: sectorData.sector, code });
                    if (exists) continue;

                    const plannedDate = new Date(year, month - 1, 5 + pi * 5);
                    const limitDate = new Date(year, month - 1, 10 + pi * 5);
                    const score = scores[pi];
                    const daysOffset = score >= 80 ? -(Math.floor(Math.random() * 5)) : Math.floor(Math.random() * 8);
                    const deliveryDate = new Date(limitDate);
                    deliveryDate.setDate(deliveryDate.getDate() + daysOffset);

                    await processesCol.insertOne({
                        _id: new mongoose.Types.ObjectId(),
                        companyId,
                        cycleId,
                        code,
                        title: `${processTemplates[pi % processTemplates.length]} - ${op.name.split(' ')[0]}`,
                        sector: sectorData.sector,
                        owner: null,
                        plannedDate,
                        limitDate,
                        deliveryDate,
                        deliverySource: 'MANUAL',
                        deliveryEvidence: 'Entrega registrada',
                        score,
                        status: statusForScore(score),
                        responsibleUserId: userId,
                        deliveryStatus: 'EMAIL_SENT',
                        emailSentAt: null,
                        revertReason: null,
                        revertedBy: null,
                        revertedAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    } as any);

                    totalProcesses++;
                }
            }

            console.log(`   👤 ${op.name.padEnd(22)} | R$${String(op.salary).padStart(6)} | ${email}`);
        }
    }

    // ── Final summary ──
    console.log(`\n${'═'.repeat(50)}`);
    console.log('✨ Seed completed!');
    console.log(`${'═'.repeat(50)}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Operadores: ${totalOperators}`);
    console.log(`   Processos criados: ${totalProcesses}`);
    console.log(`\n📋 Setores e expectativa:`);
    for (const s of SECTOR_DATA) {
        const icon = s.targetAvg === 'low' ? '🔴 ABAIXO de 75%' : s.targetAvg === 'medium' ? '🟡 APERTADO (~76%)' : '🟢 ACIMA de 75%';
        console.log(`   ${s.sector.padEnd(18)} → ${icon} (${s.operators.length} operadores)`);
    }
    console.log(`\n🔑 Senha de todos os operadores: operador123`);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
