import mongoose from 'mongoose';
import { User, Process, Cycle } from '../models';
import { UserRole } from '../types';
import { config } from '../config';

async function verify() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(config.mongodbUri);
        console.log('Connected.');

        // 1. Find or create an operator user
        let operator = await User.findOne({ roles: UserRole.OPERATOR });
        if (!operator) {
            console.log('Creating test operator...');
            operator = await User.create({
                name: 'Test Operator',
                email: 'test_operator@metodochronos.com',
                passwordHash: 'password123',
                roles: [UserRole.OPERATOR],
                companyAccess: []
            });
        }

        console.log(`Testing with user: ${operator.email} (Role: ${operator.roles.join(',')})`);

        // 2. Simulate the createProcess check logic
        // We can't easily call the controller directly without a mock Request/Response, 
        // but we can verify the logic we added:
        
        /*
        const { roles: globalRoles, companyAccess } = req.user!;
        const currentCompanyAccess = (companyAccess || []).find(a => a.companyId === companyId);
        const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
        const isMaster = globalRoles.includes(UserRole.MASTER) || (companyRole as any) === UserRole.MASTER;
        const isManager = (companyRole as any) === UserRole.MANAGER || globalRoles.includes(UserRole.MANAGER);

        if (!isMaster && !isManager) {
            throw new AppError('Apenas administradores e gestores podem criar processos.', 403);
        }
        */

        const globalRoles = operator.roles;
        const companyAccess: any[] = operator.companyAccess;
        const companyId = operator.activeCompanyId?.toString() || 'some_company_id';
        
        const currentCompanyAccess = companyAccess.find(a => a.companyId === companyId);
        const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
        
        const isMaster = globalRoles.includes(UserRole.MASTER) || companyRole === UserRole.MASTER;
        const isManager = globalRoles.includes(UserRole.MANAGER) || companyRole === UserRole.MANAGER;

        console.log('Verification Logic:');
        console.log(`- isMaster: ${isMaster}`);
        console.log(`- isManager: ${isManager}`);
        
        if (!isMaster && !isManager) {
            console.log('✅ SUCCESS: Operator is correctly identified as restricted.');
        } else {
            console.log('❌ FAILURE: Operator still has create permissions.');
        }

    } catch (error) {
        console.error('Error during verification:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verify();
