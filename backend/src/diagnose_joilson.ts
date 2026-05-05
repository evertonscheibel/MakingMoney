
import mongoose from 'mongoose';
import { User, Cycle, Company } from './models';
import { config } from './config';

async function diagnose() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        const users = await User.find({
            $or: [
                { name: { $regex: 'Joilson', $options: 'i' } },
                { email: { $regex: 'Joilson', $options: 'i' } }
            ]
        });

        console.log(`Found ${users.length} users matching 'Joilson'`);

        if (users.length === 0) {
            console.log("No user found for Joilson. Listing all users:");
            const allUsers = await User.find({}).select('name email roles');
            allUsers.forEach(u => console.log(`- ${u.name} (${u.email}) [${u.roles.join(', ')}]`));
        }

        for (const user of users) {
            console.log('------------------------------------------------');
            console.log(`User: ${user.name} (${user.email})`);
            console.log(`ID: ${user._id}`);
            console.log(`Roles: ${JSON.stringify(user.roles)}`);
            console.log(`Sectors (Array): ${JSON.stringify((user as any).sectors)}`);
            console.log(`Sector (Legacy): ${(user as any).sector}`);
            console.log(`Active Company ID: ${user.activeCompanyId}`);
            console.log(`Company Access:`, JSON.stringify(user.companyAccess, null, 2));

            if (user.activeCompanyId) {
                const company = await Company.findById(user.activeCompanyId);
                console.log(`Active Company Name: ${company?.name}`);

                // Check cycles for this company
                const cycles = await Cycle.find({ companyId: user.activeCompanyId });
                console.log(`Cycles for this company: ${cycles.length}`);
                cycles.forEach(c => {
                    console.log(`- Cycle: ${c.month}, Sector: ${c.sector}, Status: ${c.status}`);
                });
            } else {
                console.log("User has no active company ID set.");
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
