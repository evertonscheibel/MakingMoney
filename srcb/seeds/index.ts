import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User, Company, Cycle, Process, EvaluationConfig, getCurrentMonth } from '../models';
import { UserRole, ProcessStatus, CycleStatus } from '../types';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/metodo_chronos';

async function seed(): Promise<void> {
    try {
        console.log('🌱 Starting seed process...');
        console.log(`   Connecting to: ${MONGODB_URI}`);

        await mongoose.connect(MONGODB_URI);
        console.log('✅ Database connected');

        // Clear existing data (optional - comment out to preserve existing data)
        console.log('🗑️  Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Company.deleteMany({}),
            Cycle.deleteMany({}),
            Process.deleteMany({}),
            EvaluationConfig.deleteMany({}),
        ]);

        // Create companies
        console.log('🏢 Creating companies...');
        const company1 = await Company.create({
            name: 'Empresa Demo',
            sectors: ['Financeiro', 'RH', 'TI', 'Comercial'],
            isActive: true,
        });

        const company2 = await Company.create({
            name: 'Empresa Teste',
            sectors: ['Administrativo', 'Produção', 'Logística'],
            isActive: true,
        });

        console.log(`   Created: ${company1.name}, ${company2.name}`);

        // Create admin user
        console.log('👤 Creating users...');
        const admin = await User.create({
            name: 'Administrador',
            email: 'admin@metodochronos.com',
            passwordHash: 'admin123',
            roles: [UserRole.MASTER],
            companyAccess: [
                { companyId: company1._id, role: UserRole.MASTER },
                { companyId: company2._id, role: UserRole.MASTER }
            ],
            activeCompanyId: company1._id,
        });

        const manager = await User.create({
            name: 'Gerente Demo',
            email: 'gerente@metodochronos.com',
            passwordHash: 'manager123',
            roles: [UserRole.MANAGER],
            companyAccess: [
                { companyId: company1._id, role: UserRole.MANAGER }
            ],
            activeCompanyId: company1._id,
        });

        const operator = await User.create({
            name: 'Operador Demo',
            email: 'operador@metodochronos.com',
            passwordHash: 'operador123',
            roles: [UserRole.OPERATOR],
            companyAccess: [
                { companyId: company1._id, role: UserRole.OPERATOR }
            ],
            activeCompanyId: company1._id,
        });

        console.log('   Created: admin@gestaopro.com (password: admin123)');
        console.log('   Created: gerente@gestaopro.com (password: manager123)');
        console.log('   Created: operador@gestaopro.com (password: operador123)');

        // Create evaluation config
        console.log('⚙️  Creating evaluation config...');
        await EvaluationConfig.create({
            companyId: company1._id,
            version: 1,
            rules: {
                earlyDeliveryScore: 100,
                onTimeScore: 75,
                halfwayScore: 50,
                lateScore: 25,
                criticalScore: 0,
                toleranceDays: 0,
            },
            createdBy: admin._id,
            isActive: true,
        });

        // Create current cycle
        console.log('📅 Creating cycle...');
        const currentMonth = getCurrentMonth();
        const cycle = await Cycle.create({
            companyId: company1._id,
            month: currentMonth,
            status: CycleStatus.OPEN,
            openedAt: new Date(),
        });
        console.log(`   Created cycle: ${currentMonth}`);

        // Create sample processes
        console.log('📋 Creating sample processes...');
        const today = new Date();
        const processData = [
            {
                code: '101',
                title: 'Fechamento Contábil Mensal',
                sector: 'Financeiro',
                owner: 'João Silva',
                plannedOffset: -5,
                limitOffset: 10,
            },
            {
                code: '102',
                title: 'Conciliação Bancária',
                sector: 'Financeiro',
                owner: 'Maria Santos',
                plannedOffset: 0,
                limitOffset: 5,
            },
            {
                code: '201',
                title: 'Processamento de Folha',
                sector: 'RH',
                owner: 'Ana Costa',
                plannedOffset: -3,
                limitOffset: 7,
            },
            {
                code: '202',
                title: 'Atualização de Benefícios',
                sector: 'RH',
                owner: 'Pedro Lima',
                plannedOffset: 2,
                limitOffset: 15,
            },
            {
                code: '301',
                title: 'Backup de Sistemas',
                sector: 'TI',
                owner: 'Carlos Oliveira',
                plannedOffset: -7,
                limitOffset: 3,
            },
            {
                code: '302',
                title: 'Atualização de Servidores',
                sector: 'TI',
                owner: 'Lucas Souza',
                plannedOffset: 5,
                limitOffset: 20,
            },
            {
                code: '401',
                title: 'Relatório de Vendas',
                sector: 'Comercial',
                owner: 'Fernanda Rocha',
                plannedOffset: -2,
                limitOffset: 8,
            },
            {
                code: '402',
                title: 'Análise de Metas',
                sector: 'Comercial',
                owner: 'Roberto Alves',
                plannedOffset: 3,
                limitOffset: 12,
            },
        ];

        for (const data of processData) {
            const plannedDate = new Date(today);
            plannedDate.setDate(plannedDate.getDate() + data.plannedOffset);

            const limitDate = new Date(today);
            limitDate.setDate(limitDate.getDate() + data.limitOffset);

            // Assign some processes to the operator for testing
            const responsibleUserId = (data.code.startsWith('10') || data.code.startsWith('40'))
                ? operator._id
                : null;

            await Process.create({
                companyId: company1._id,
                cycleId: cycle._id,
                code: data.code,
                title: data.title,
                sector: data.sector,
                owner: data.owner,
                plannedDate,
                limitDate,
                status: ProcessStatus.PENDING,
                responsibleUserId,
            });
        }
        console.log(`   Created ${processData.length} processes`);

        // Summary
        console.log('\n✨ Seed completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Companies: 2`);
        console.log(`   Users: 3`);
        console.log(`   Cycles: 1`);
        console.log(`   Processes: ${processData.length}`);
        console.log('\n🔑 Login credentials:');
        console.log('   Admin: admin@gestaopro.com / admin123');
        console.log('   Manager: gerente@gestaopro.com / manager123');
        console.log('   Operator: operador@gestaopro.com / operador123');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seed();

