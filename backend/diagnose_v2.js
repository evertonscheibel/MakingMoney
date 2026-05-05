
const mongoose = require('mongoose');
// Since the project is TS, I'll try to require the compiled JS or just use mongoose directly on the collections if needed.
// But wait, the project uses ts-node for dev.
// Let's try to just use a very simple JS script that doesn't import models but uses mongoose.connection.db.collection

const mongoUri = 'mongodb://localhost:27017/gestaopro'; // Default, but let's try to find it from config

async function diagnose() {
    try {
        // Try to load URI from .env if it exists
        require('dotenv').config({ path: './.env' });
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gestaopro';
        
        await mongoose.connect(uri);
        console.log('--- Database Connected ---');

        const db = mongoose.connection.db;

        const companies = await db.collection('companies').find({}).toArray();
        console.log(`Found ${companies.length} companies.`);

        for (const company of companies) {
            console.log(`\nCompany: ${company.name} (${company._id})`);
            
            // In the DB, companyId in companyAccess is stored as ObjectId
            const operators = await db.collection('users').find({ 
                'companyAccess.companyId': company._id 
            }).toArray();
            console.log(`- Total Users with access: ${operators.length}`);
            
            for (const op of operators) {
                const access = op.companyAccess.find(a => a.companyId.toString() === company._id.toString());
                if (access && access.role === 'operator') {
                    console.log(`  - Operator: ${op.name} (${op.email})`);
                    console.log(`    - Roles: ${op.roles?.join(', ')}`);
                    console.log(`    - Sector (Legacy): ${op.sector || 'None'}`);
                    console.log(`    - Sectors: ${op.sectors?.join(', ') || 'None'}`);
                    
                    const myProcesses = await db.collection('processes').countDocuments({ companyId: company._id, responsibleUserId: op._id });
                    console.log(`    - Assigned Processes: ${myProcesses}`);
                }
            }
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnosis failed:', error);
        process.exit(1);
    }
}

diagnose();
