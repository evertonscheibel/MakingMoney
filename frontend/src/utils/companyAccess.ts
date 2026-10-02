import { Company, User, UserRole } from '../types';

export function getAccessibleSectors(user: User | null, company?: Company | null) {
    if (!user || !company) return [];
    if (user.roles.includes(UserRole.MASTER)) return company.sectors || [];
    const companyId = company.id || company._id;
    const access = user.companyAccess?.find(a => String(a.companyId) === String(companyId));
    const sectors = access?.sectors?.length ? access.sectors : [...(user.sectors || []), ...(user.sector ? [user.sector] : [])];
    const id = user.id || user._id;
    return (company.sectors || []).filter(s => sectors.includes(s.name) ||
        String(s.managerId || '') === String(id) || s.managerIds?.some(manager => String(manager) === String(id)));
}

export function normalizeCompanyUser(user: User): User {
    const globalRoles = user.globalRoles || user.roles;
    const access = user.companyAccess?.find(a => String(a.companyId) === String(user.activeCompanyId));
    const role = globalRoles.includes(UserRole.MASTER) ? UserRole.MASTER : access?.role || UserRole.OPERATOR;
    return { ...user, globalRoles, roles: [role] };
}
