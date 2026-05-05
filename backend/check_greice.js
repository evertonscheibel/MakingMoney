
const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Projetos/MakingMoney/backend/.env' });

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestaopro');
        console.log('Connected to MongoDB');

        const user = await mongoose.model('User').findOne({ email: /greice/i });
        if (user) {
            console.log('User Found:', user.name);
            console.log('Email:', user.email);
            console.log('Roles:', user.roles);
            console.log('Sector:', user.sector); // This is the key field
            console.log('AllowedMenus:', user.allowedMenus);
        } else {
            console.log('User Greice not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Define minimal schema if needed, but usually we can find without it if we don't strictly type it in raw JS
// However, since Mongoose relies on schemas, I should probably reuse the connection logic or define a simple schema.
// Let's assume the existing User model file works if I import it, OR I just define a raw query.
// Simpler: Just define a schema on the fly.

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    roles: [String],
    sector: String,
    allowedMenus: [String]
}, { strict: false });

mongoose.model('User', userSchema);

checkUser();
