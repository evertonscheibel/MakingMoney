
const mongoose = require('mongoose');
const { Schema } = mongoose;

async function debug() {
    await mongoose.connect('mongodb://localhost:27017/MMdb');

    const User = mongoose.model('User', new Schema({}, { strict: false }), 'users');
    const Process = mongoose.model('Process', new Schema({}, { strict: false }), 'processes');
    const Company = mongoose.model('Company', new Schema({}, { strict: false }), 'companies');
    const EvaluationConfig = mongoose.model('EvaluationConfig', new Schema({}, { strict: false }), 'evaluationconfigs');

    const greice = await User.findOne({
        $or: [
            { name: /greice/i },
            { email: /greice/i }
        ]
    });

    console.log('User Greice:', greice ? { id: greice._id, name: greice.name, email: greice.email, activeCompanyId: greice.activeCompanyId } : 'Not found');

    if (greice) {
        const process001 = await Process.findOne({
            code: '001',
            companyId: greice.activeCompanyId
        });

        console.log('Process 001:', process001 ? {
            id: process001._id,
            code: process001.code,
            title: process001.title,
            sector: process001.sector,
            plannedDate: process001.plannedDate,
            limitDate: process001.limitDate,
            deliveryDate: process001.deliveryDate,
            score: process001.score,
            status: process001.status,
            deliveryStatus: process001.deliveryStatus
        } : 'Not found');

        const allConfigs = await EvaluationConfig.find({ companyId: greice.activeCompanyId }).sort({ version: -1 });
        console.log(`Found ${allConfigs.length} config(s) for company ${greice.activeCompanyId}:`);
        allConfigs.forEach(c => {
            console.log(`v${c.version} - isActive: ${c.isActive} - Rules:`, JSON.stringify(c.rules, null, 2));
        });

        const evalConfig = await EvaluationConfig.findOne({ companyId: greice.activeCompanyId, isActive: true });
        console.log('Currently Active Eval Config Rules:', evalConfig ? evalConfig.rules : 'Default used');
    }

    await mongoose.disconnect();
}

debug().catch(console.error);
