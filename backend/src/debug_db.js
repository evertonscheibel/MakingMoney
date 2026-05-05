const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/MMdb')
    .then(async () => {
        console.log('Connected to MongoDB (MMdb)');

        // Count total processes
        const totalProcesses = await mongoose.connection.db.collection('processes').countDocuments();
        console.log(`Total processes in database: ${totalProcesses}`);

        // Get unique sectors
        const sectors = await mongoose.connection.db.collection('processes').distinct('sector');
        console.log('\nSectors found in processes:');
        sectors.forEach(s => console.log(`  - "${s}"`));

        // Count processes per sector
        console.log('\nProcesses per sector:');
        for (const sector of sectors) {
            const count = await mongoose.connection.db.collection('processes').countDocuments({ sector });
            console.log(`  ${sector}: ${count} processes`);
        }

        // Get companies and their sectors
        console.log('\n--- Companies and Sectors ---');
        const companies = await mongoose.connection.db.collection('companies').find().toArray();
        companies.forEach(c => {
            console.log(`\nCompany: ${c.name}`);
            console.log('  Sectors:', JSON.stringify(c.sectors, null, 2));
        });

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
