const mongoose = require('mongoose');

async function debug() {
    try {
        await mongoose.connect('mongodb://localhost:27017/metodo_chronos');
        console.log('Connected to metodo_chronos');

        const db = mongoose.connection.db;
        const users = await db.collection('users').find({}).toArray();

        console.log('\n--- ALL USERS ---');
        users.forEach(u => console.log(u.email));

        // Let's also try gestaopro just in case
        await mongoose.disconnect();
        await mongoose.connect('mongodb://localhost:27017/gestaopro');
        console.log('\nConnected to gestaopro');
        const db2 = mongoose.connection.db;
        const users2 = await db2.collection('users').find({}).toArray();
        console.log('\n--- ALL USERS IN GESTAOPRO ---');
        users2.forEach(u => console.log(u.email));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
