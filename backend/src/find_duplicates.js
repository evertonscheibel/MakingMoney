
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        const Process = mongoose.model('Process', new mongoose.Schema({}, { strict: false }));

        // Check if same code has different titles in the same sector
        const codeInconsistency = await Process.aggregate([
            {
                $group: {
                    _id: { sector: '$sector', code: '$code' },
                    titles: { $addToSet: '$title' },
                    count: { $sum: 1 }
                }
            },
            { $match: { $expr: { $gt: [{ $size: '$titles' }, 1] } } }
        ]);

        console.log(`\nFound ${codeInconsistency.length} sectors where the same code has different titles.`);
        codeInconsistency.forEach(inc => {
            console.log(`Sector: ${inc._id.sector}, Code: ${inc._id.code}`);
            console.log(`  Titles: ${inc.titles.join(' | ')}`);
        });

        // Check if same title has different codes in the same sector
        const titleInconsistency = await Process.aggregate([
            {
                $group: {
                    _id: { sector: '$sector', title: '$title' },
                    codes: { $addToSet: '$code' },
                    count: { $sum: 1 }
                }
            },
            { $match: { $expr: { $gt: [{ $size: '$codes' }, 1] } } }
        ]);

        console.log(`\nFound ${titleInconsistency.length} sectors where the same title has different codes.`);
        titleInconsistency.forEach(inc => {
            console.log(`Sector: ${inc._id.sector}, Title: ${inc._id.title}`);
            console.log(`  Codes: ${inc.codes.join(' | ')}`);
        });

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Diagnostic failed:', error);
        process.exit(1);
    }
}

diagnose();
