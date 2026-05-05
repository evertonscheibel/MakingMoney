
import mongoose from 'mongoose';
import { User } from './models';
import { config } from './config';

async function fix() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database');

        const user = await User.findOne({
            $or: [
                { email: { $regex: 'joilson.fiscal@frizelo.com.br', $options: 'i' } },
                { name: { $regex: 'Joilson', $options: 'i' } }
            ]
        });

        if (!user) {
            console.error('User Joilson not found!');
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (${user.email})`);
        console.log(`Current sectors: ${JSON.stringify((user as any).sectors)}`);

        // Update sectors
        (user as any).sectors = ['Contabilidade/Fiscal'];

        // Also ensure companyAccess matches if needed, but primarily sectors.
        // Assuming companyAccess is already correct based on previous diagnosis (User had operator role in company).

        await user.save();

        console.log(`Updated sectors to: ${JSON.stringify((user as any).sectors)}`);
        console.log('User updated successfully.');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

fix();
