const MENU_ALIASES: Record<string, string[]> = {
    'bonus-report': ['bonuses'],
};

export function normalizeMenuId(menuId: string) {
    return menuId === 'bonuses' ? 'bonus-report' : menuId;
}

export function normalizeAllowedMenus(menuIds: string[] = []) {
    return menuIds.map(normalizeMenuId);
}

export function hasMenuAccess(allowedMenus: string[] | undefined, menuId: string) {
    if (!allowedMenus?.length) return false;

    const normalizedAllowedMenus = new Set(normalizeAllowedMenus(allowedMenus));
    const candidateIds = [menuId, ...(MENU_ALIASES[menuId] || [])].map(normalizeMenuId);

    return candidateIds.some((id) => normalizedAllowedMenus.has(id));
}
