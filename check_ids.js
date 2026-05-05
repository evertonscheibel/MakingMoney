const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const { Company, Cycle, User } = require('./backend/dist/models'); // Using dist/models if compiled, or backend/src/models if not

async function findData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/makingmoney');
        console.log('Connected to MongoDB');

        const company = await mongoose.model('Company').findOne({ name: /Frizelo/i });
        if (!company) {
            console.log('Company not found');
            return;
        }
        console.log('Company:', { id: company._id, name: company.name });

        const cycle = await mongoose.model('Cycle').findOne({ companyId: company._id, status: 'OPEN' });
        console.log('Open Cycle:', cycle ? { id: cycle._id, month: cycle.month } : 'Nonefound');

        const adminUser = await mongoose.model('User').findOne({ companyAccess: company._id, roles: 'ADMIN' });
        console.log('Admin User:', adminUser ? { id: adminUser._id, name: adminUser.name } : 'None found');

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findData();
