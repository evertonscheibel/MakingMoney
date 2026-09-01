/**
 * Migrates the legacy flat `user.sectors` list into per-company sector
 * permissions (`user.companyAccess[].sectors`).
 *
 * For each company a user can access, only the sector names that actually
 * exist in THAT company are copied over. This both preserves current access
 * and stops one company's sector names from being (incorrectly) treated as
 * valid in another.
 *
 * The legacy `sectors`/`sector` fields are intentionally left untouched:
 * getEffectiveSectors still falls back to them when a company entry has no
 * scoped sectors, so this migration is safe to run incrementally and is
 * reversible by simply clearing companyAccess[].sectors.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/migrate_sectors_per_company.ts          # dry run (default)
 *   npx ts-node --transpile-only src/scripts/migrate_sectors_per_company.ts --apply  # write changes
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User, Company } from '../models';
import { UserRole } from '../types';

const APPLY = process.argv.includes('--apply');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gestaopro';

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to ${MONGODB_URI}`);
    console.log(APPLY ? '>>> APPLY MODE — changes WILL be written\n' : '>>> DRY RUN — no changes will be written (use --apply to write)\n');

    const [users, companies] = await Promise.all([User.find({}), Company.find({})]);
    const companiesById = new Map(companies.map((c) => [c._id.toString(), c]));

    let usersChanged = 0;
    let entriesFilled = 0;
    const warnings: string[] = [];

    for (const user of users) {
        const legacy = [
            ...(((user as any).sectors as string[]) || []),
            ...(user.sector ? [user.sector] : []),
        ];
        const legacySectors = [...new Set(legacy.filter(Boolean))];
        if (legacySectors.length === 0) continue;

        let touched = false;

        for (const access of user.companyAccess || []) {
            const existing: string[] = ((access as any).sectors as string[]) || [];
            if (existing.length > 0) continue; // already migrated — never overwrite

            const company = companiesById.get(access.companyId.toString());
            if (!company) continue;

            const companySectorNames = company.sectors.map((s) => s.name);
            const applicable = legacySectors.filter((s) => companySectorNames.includes(s));

            if (applicable.length > 0) {
                (access as any).sectors = applicable;
                touched = true;
                entriesFilled++;
                console.log(
                    `  ${user.email} @ ${company.name}: [${applicable.join(', ')}]` +
                    (applicable.length < legacySectors.length
                        ? `  (dropped for this company: ${legacySectors.filter((s) => !applicable.includes(s)).join(', ')})`
                        : '')
                );
            } else if (!user.roles.includes(UserRole.MASTER)) {
                warnings.push(
                    `  ${user.email} @ ${company.name}: NONE of [${legacySectors.join(', ')}] exist in this company ` +
                    `(company has: ${companySectorNames.join(', ') || 'no sectors'}) — user currently sees no processes there.`
                );
            }
        }

        if (touched) {
            usersChanged++;
            user.markModified('companyAccess');
            if (APPLY) await user.save();
        }
    }

    console.log(`\nUsers updated: ${usersChanged}`);
    console.log(`Company access entries filled: ${entriesFilled}`);

    if (warnings.length > 0) {
        console.log(`\n!! ${warnings.length} access entries with NO valid sector for that company:`);
        warnings.forEach((w) => console.log(w));
        console.log('\nThese need a human decision — the sector was likely renamed, or the user was');
        console.log('given access to a company whose sectors are named differently. Fix them in');
        console.log('Configurações -> Usuários (the sector audit banner lists exactly these).');
    }

    if (!APPLY) console.log('\nDRY RUN — nothing was written. Re-run with --apply to persist.');

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
