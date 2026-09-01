import { AuthenticatedUser } from '../types';

/**
 * Resolves the sectors a user is allowed to see/manage WITHIN A SPECIFIC COMPANY.
 *
 * Sector names are not globally unique across companies (two companies can name
 * a sector differently for the same kind of work, or rename a sector over time),
 * so a user's sector permissions must be resolved per company, not from one flat
 * global list. This function centralizes that resolution so every controller
 * applies the exact same rule.
 *
 * Resolution order:
 *  1. If the user's companyAccess entry for this company has its own `sectors`
 *     list (non-empty), use ONLY that — it is authoritative once set.
 *  2. Otherwise, fall back to the user's legacy global `sectors` array plus the
 *     legacy singular `sector` field, for accounts not yet migrated to
 *     per-company sector permissions.
 *
 * Sectors a user manages (company.sectors[].managerId === userId) are merged
 * in on top by the caller, since that depends on the Company document.
 */
export function getEffectiveSectors(
    user: Pick<AuthenticatedUser, 'companyAccess' | 'sectors' | 'sector'>,
    companyId: string
): string[] {
    const entry = (user.companyAccess || []).find((a) => a.companyId === companyId);

    if (entry?.sectors && entry.sectors.length > 0) {
        return [...new Set(entry.sectors)];
    }

    const legacy = [
        ...((user.sectors as string[]) || []),
        ...(user.sector ? [user.sector] : []),
    ];
    return [...new Set(legacy)];
}
