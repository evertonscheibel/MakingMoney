
import { connectDatabase, disconnectDatabase } from '../config/database';
import { EmailService } from '../services/email.service';
import { Company, EmailConfig } from '../models'; // Adjust imports based on your unexpected exports if needed
import { Types } from 'mongoose';
import { logger } from '../config';

async function testEmailQueue() {
    try {
        await connectDatabase();
        logger.info('Connected to database');

        // 1. Find a valid company
        const company = await Company.findOne({});
        if (!company) {
            console.error('No company found to test with.');
            return;
        }
        console.log(`Using company: ${company.name} (${company._id})`);

        // 2. Check if email config exists
        const emailConfig = await EmailConfig.findOne({ companyId: company._id, isActive: true });
        if (!emailConfig) {
            console.warn('No active email config found for this company. EmailService.enqueue might return false.');
        } else {
            console.log(`Found active email config for user: ${emailConfig.auth.user}`);
        }

        // 3. Try to enqueue an email
        try {
            const result = await EmailService.enqueue(company._id.toString(), {
                to: 'test@example.com',
                subject: 'Test Email from Script',
                html: '<p>This is a test email to verify the queue.</p>',
                category: 'test'
            });
            console.log(`Email enqueued result: ${result}`);
        } catch (error: any) {
            console.error('Error queuing email:', error);
            console.error('Stack:', error.stack);
        }

    } catch (error) {
        console.error('Script error:', error);
    } finally {
        await disconnectDatabase();
        logger.info('Disconnected from database');
    }
}

testEmailQueue();

