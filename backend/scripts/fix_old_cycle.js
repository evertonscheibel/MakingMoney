const { MongoClient } = require('mongodb');

(async () => {
    const c = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = c.db('MMdb');
    const r = await db.collection('cycles').updateOne(
        { month: '2026-01' },
        { $set: { sector: 'Controladoria' } }
    );
    console.log('Updated old cycle:', r.modifiedCount);
    await c.close();
})();
