const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/MMdb')
    .then(async () => {
        console.log('Connected to MongoDB (MMdb)');

        // 1. Update processes from Financeiro to Controladoria
        const result = await mongoose.connection.db.collection('processes').updateMany(
            { sector: 'Financeiro' },
            { $set: { sector: 'Controladoria' } }
        );
        console.log(`Updated ${result.modifiedCount} processes from "Financeiro" to "Controladoria"`);

        // 2. Add missing sectors to Frizelo company
        const company = await mongoose.connection.db.collection('companies').findOne({ name: 'Frizelo Frigorificos Ltda' });
        if (company) {
            const currentSectors = company.sectors || [];
            const currentSectorNames = currentSectors.map(s => typeof s === 'string' ? s : s.name);

            const sectorsToAdd = ['Comercial', 'RH', 'TI'].filter(s => !currentSectorNames.includes(s));

            if (sectorsToAdd.length > 0) {
                const newSectors = sectorsToAdd.map(name => ({ name, managerId: null }));
                await mongoose.connection.db.collection('companies').updateOne(
                    { _id: company._id },
                    { $push: { sectors: { $each: newSectors } } }
                );
                console.log(`Added sectors to company: ${sectorsToAdd.join(', ')}`);
            } else {
                console.log('All sectors already exist in company');
            }
        }

        // Verify
        console.log('\n--- Verification ---');
        const processCount = await mongoose.connection.db.collection('processes').countDocuments({ sector: 'Controladoria' });
        console.log(`Total processes with sector 'Controladoria': ${processCount}`);

        const updatedCompany = await mongoose.connection.db.collection('companies').findOne({ name: 'Frizelo Frigorificos Ltda' });
        console.log('Company sectors:', JSON.stringify(updatedCompany.sectors, null, 2));

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
