import mongoose from 'mongoose';
import { User } from '../models';
import { UserRole } from '../types';
import { config } from '../config';

async function debugUser() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to MongoDB');

        const email = 'everton.suporte@frizelo.com.br';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User with email ${email} not found.`);
            return;
        }

        console.log('\n--- USER DEBUG ---');
        console.log('ID:', user._id);
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Global Roles:', user.roles);
        console.log('Active Company ID:', user.activeCompanyId);
        console.log('Company Access:', JSON.stringify(user.companyAccess, null, 2));
        
        // Mock the check logic
        const companyId = user.activeCompanyId?.toString();
        const globalRoles = user.roles;
        const companyAccess: any[] = user.companyAccess || [];
        
        const currentCompanyAccess = companyAccess.find(a => a.companyId?.toString() === companyId);
        const companyRole = currentCompanyAccess?.role || UserRole.OPERATOR;
        
        const isMaster = globalRoles.includes(UserRole.MASTER) || companyRole === UserRole.MASTER;
        const isManager = globalRoles.includes(UserRole.MANAGER) || companyRole === UserRole.MANAGER;

        console.log('\n--- PERMISSION CHECK SIMULATION ---');
        console.log('Company ID used for check:', companyId);
        console.log('Determined Company Role:', companyRole);
        console.log('isMaster:', isMaster);
        console.log('isManager:', isManager);
        console.log('Allowed to create?:', isMaster || isManager);

    } catch (error) {
        console.error('Debug error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugUser();
