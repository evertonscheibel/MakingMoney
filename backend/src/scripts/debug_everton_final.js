const mongoose = require('mongoose');

async function debug() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/MMdb');
        console.log('Connected to MMdb');

        const db = mongoose.connection.db;
        const users = await db.collection('users').find({ email: 'everton.suporte@frizelo.com.br' }).toArray();

        if (users.length === 0) {
            console.log('User not found in MMdb');
            // Try lowercase or search by name
            const all = await db.collection('users').find({ name: /Everton/i }).toArray();
            console.log('Results by name:', all.map(u => u.email));
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
