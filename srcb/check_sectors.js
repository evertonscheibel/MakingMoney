const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/metodo_chronos')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Get all unique sectors
        const sectors = await mongoose.connection.db.collection('processes').distinct('sector');
        console.log('Sectors found in processes:');
        sectors.forEach(s => console.log(`  - "${s}"`));

        // Count processes per sector
        console.log('\nProcesses per sector:');
        for (const sector of sectors) {
            const count = await mongoose.connection.db.collection('processes').countDocuments({ sector });
            console.log(`  ${sector}: ${count} processes`);
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
