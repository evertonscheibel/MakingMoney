
const mongoose = require('mongoose');
const { User } = require('./models');
const { config } = require('./config');

async function diagnose() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        const users = await User.find({});
        console.log(`Found ${users.length} users`);

        users.forEach(user => {
            console.log(`Checking user: ${user.email}`);
            if (!user.roles) {
                console.error(`  [ERROR] User ${user.email} has no roles!`);
            } else if (!Array.isArray(user.roles)) {
                console.error(`  [ERROR] User ${user.email} roles is not an array:`, typeof user.roles);
            }

            if (user.companyAccess && !Array.isArray(user.companyAccess)) {
                console.error(`  [ERROR] User ${user.email} companyAccess is not an array:`, typeof user.companyAccess);
            }

            // Check for sectors
            if (user.sectors && !Array.isArray(user.sectors)) {
                console.error(`  [ERROR] User ${user.email} sectors is not an array:`, typeof user.sectors);
            }
        });

        process.exit(0);
    } catch (error) {
        console.error('Diagnosis failed:', error);
        process.exit(1);
    }
}

diagnose();
