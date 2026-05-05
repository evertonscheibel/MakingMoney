const mongoose = require('mongoose');
// Adjust path to point to compiled JS
const { EmailService } = require('../dist/services/email.service');
const { EmailQueue } = require('../dist/models');

mongoose.connect('mongodb://localhost:27017/MMdb')
    .then(async () => {
        console.log('Connected to MongoDB');

        const companyId = '6968f9815472b311ec72ce04'; // Frizelo
        const recipient = 'test_debug@example.com';

        console.log(`Queuing test email to ${recipient}...`);

        try {
            await EmailService.enqueue(companyId, {
                to: recipient,
                subject: 'Debug Test Email',
                html: '<p>This is a debug test email.</p>',
                category: 'debug'
            });
            console.log('Email queued successfully.');
        } catch (e) {
            console.error('Failed to queue email:', e);
            process.exit(1);
        }

        // Poll for status change (waiting for main server worker to pick it up)
        console.log('Waiting for Main Server Worker to process it...');

        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            const email = await EmailQueue.findOne({ to: recipient }).sort({ createdAt: -1 });

            if (email) {
                console.log(`[Attempt ${attempts}] Status: ${email.status}`);
                if (email.status === 'SENT') {
                    console.log('SUCCESS: Email was sent!');
                    clearInterval(interval);
                    process.exit(0);
                }
                if (email.status === 'FAILED') {
                    console.log('FAILURE: Email failed to send.');
                    console.log('Error:', email.lastError);
                    clearInterval(interval);
                    process.exit(1);
                }
            } else {
                console.log('Email not found in queue?');
            }

            if (attempts >= 10) { // Timeout after ~20s
                console.log('TIMEOUT: Worker did not process the email in time.');
                clearInterval(interval);
                process.exit(1);
            }
        }, 2000);

    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
