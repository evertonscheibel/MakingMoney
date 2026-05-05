const mongoose = require('mongoose');

async function debug() {
    try {
        await mongoose.connect('mongodb://localhost:27017/metodo_chronos');
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const users = await db.collection('users').find({ email: 'everton.suporte@frizelo.com.br' }).toArray();

        if (users.length === 0) {
            console.log('User not found');
            return;
        }

        const user = users[0];
        console.log('\n--- RAW USER DATA ---');
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Roles:', JSON.stringify(user.roles));
        console.log('Company Access:', JSON.stringify(user.companyAccess, null, 2));
        console.log('Allowed Menus:', JSON.stringify(user.allowedMenus));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
