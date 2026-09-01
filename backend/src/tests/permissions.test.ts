import { getEffectiveSectors } from '../utils';
import { UserRole } from '../types';

/**
 * Sector permissions must be resolved PER COMPANY. A user working in two
 * companies that name their sectors differently ("Contabilidade" vs
 * "Contabilidade/Fiscal") previously shared one flat global list, so one
 * company's sector names silently failed to match the other's — making that
 * company's processes invisible to them with no error anywhere.
 */
describe('getEffectiveSectors', () => {
    const companyA = '6a1e2ad692c7c257796e4fd6';
    const companyB = '6968f9815472b311ec72ce04';

    it('uses the per-company sectors when set, ignoring the legacy global list', () => {
        const user = {
            companyAccess: [
                { companyId: companyA, role: UserRole.OPERATOR, sectors: ['Contabilidade'] },
                { companyId: companyB, role: UserRole.OPERATOR, sectors: ['Contabilidade/Fiscal'] },
            ],
            sectors: ['Financeiro'], // legacy, must not leak in once scoped values exist
            sector: '',
        };

        expect(getEffectiveSectors(user, companyA)).toEqual(['Contabilidade']);
        expect(getEffectiveSectors(user, companyB)).toEqual(['Contabilidade/Fiscal']);
    });

    it('falls back to the legacy global sectors when the company entry has none', () => {
        const user = {
            companyAccess: [{ companyId: companyA, role: UserRole.OPERATOR, sectors: [] }],
            sectors: ['Contabilidade/Fiscal'],
            sector: '',
        };

        expect(getEffectiveSectors(user, companyA)).toEqual(['Contabilidade/Fiscal']);
    });

    it('includes the legacy singular `sector` field in the fallback', () => {
        const user = {
            companyAccess: [{ companyId: companyA, role: UserRole.OPERATOR, sectors: [] }],
            sectors: [],
            sector: 'Controladoria',
        };

        expect(getEffectiveSectors(user, companyA)).toEqual(['Controladoria']);
    });

    it('does not leak one company\'s sectors into another company', () => {
        const user = {
            companyAccess: [
                { companyId: companyA, role: UserRole.OPERATOR, sectors: ['Contabilidade'] },
                { companyId: companyB, role: UserRole.OPERATOR, sectors: ['RH'] },
            ],
            sectors: [],
            sector: '',
        };

        expect(getEffectiveSectors(user, companyA)).not.toContain('RH');
        expect(getEffectiveSectors(user, companyB)).not.toContain('Contabilidade');
    });

    it('returns an empty list for a company the user has no access entry for', () => {
        const user = {
            companyAccess: [{ companyId: companyA, role: UserRole.OPERATOR, sectors: ['Contabilidade'] }],
            sectors: [],
            sector: '',
        };

        expect(getEffectiveSectors(user, companyB)).toEqual([]);
    });

    it('de-duplicates repeated sector names', () => {
        const user = {
            companyAccess: [{ companyId: companyA, role: UserRole.OPERATOR, sectors: [] }],
            sectors: ['Contabilidade', 'Contabilidade'],
            sector: 'Contabilidade',
        };

        expect(getEffectiveSectors(user, companyA)).toEqual(['Contabilidade']);
    });
});
