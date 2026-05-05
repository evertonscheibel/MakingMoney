import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, authApi, companiesApi } from '../api';
import { useAuth } from '../contexts';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle,
    XCircle,
    Shield,
    Building2,
    Menu,
    Clock,
} from 'lucide-react';
import { UserRole, User } from '../types';

interface UserFormData {
    name: string;
    email: string;
    password?: string;
    roles: UserRole[];
    allowedMenus: string[];
    allowedCompanyIds: string[];
    sector?: string;
    sectors: string[];
}

const initialFormData: UserFormData = {
    name: '',
    email: '',
    password: '',
    roles: [UserRole.OPERATOR],
    allowedMenus: [],
    allowedCompanyIds: [],
    sector: '',
    sectors: [],
};

const AVAILABLE_MENUS = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'processes', name: 'Processos' },
    { id: 'reports', name: 'Relatórios' },
    { id: 'process-curve', name: 'Curva de Processo' },
    { id: 'bonuses', name: 'Bonificações' },
    { id: 'cycle-history', name: 'Histórico de Ciclos' },
    { id: 'email-logs', name: 'Logs de Email' },
    { id: 'email-simulator', name: 'Simulador Email' },
    { id: 'ai-assistant', name: 'Assistente IA' },
    { id: 'users', name: 'Usuários' },
    { id: 'companies', name: 'Empresas' },
    { id: 'sectors', name: 'Setores' },
    { id: 'evaluation-parameters', name: 'Parâmetros de Avaliação' },
    { id: 'email-settings', name: 'Config. Email' },
    { id: 'system-logs', name: 'Logs do Sistema' },
];

const ROLE_LABELS: Record<string, string> = {
    [UserRole.MASTER]: 'MASTER',
    [UserRole.MANAGER]: 'GESTOR',
    [UserRole.OPERATOR]: 'OPERADOR',
};

export default function UserList() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<UserFormData>(initialFormData);

    const isMaster = user?.roles.includes(UserRole.MASTER);
    const isAdmin = user?.roles.includes(UserRole.MASTER);
    const canManage = isMaster || isAdmin;

    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersApi.list(),
        enabled: canManage,
    });

    const { data: companies } = useQuery({
        queryKey: ['companies'],
        queryFn: () => companiesApi.list(),
        enabled: isMaster, // Only master can see all companies to assign
    });

    // Fetch active company to get sectors
    const { data: activeCompany } = useQuery({
        queryKey: ['company', user?.activeCompanyId],
        queryFn: () => companiesApi.get(user!.activeCompanyId!),
        enabled: !!user?.activeCompanyId && isModalOpen,
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => authApi.register(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            setFormData(initialFormData);
            alert('Usuário criado com sucesso!');
        },
        onError: (error: any) => {
            alert(`Erro ao criar usuário: ${error.response?.data?.message || error.message}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            setSelectedUser(null);
            setFormData(initialFormData);
            alert('Usuário atualizado com sucesso!');
        },
        onError: (error: any) => {
            alert(`Erro ao atualizar usuário: ${error.response?.data?.message || error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => usersApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            alert('Usuário removido com sucesso!');
        },
    });

    if (!canManage) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Acesso Negado</h2>
                    <p className="text-gray-500">Você não tem permissão para acessar esta página.</p>
                </div>
            </div>
        );
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            // If editing, exclude password if empty
            ...(selectedUser && !formData.password ? { password: undefined } : {}),
        };

        if (selectedUser) {
            const userId = selectedUser.id || selectedUser._id;
            if (userId) {
                updateMutation.mutate({ id: userId, data: payload });
            }
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleEdit = (userToEdit: User) => {
        setSelectedUser(userToEdit);
        setFormData({
            name: userToEdit.name,
            email: userToEdit.email,
            password: '', // Don't show password
            roles: userToEdit.roles.filter(role => Object.values(UserRole).includes(role as UserRole)),
            allowedMenus: userToEdit.allowedMenus || [],
            allowedCompanyIds: userToEdit.allowedCompanyIds || [],
            sector: userToEdit.sector || '',
            sectors: userToEdit.sectors || [],
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
            deleteMutation.mutate(id);
        }
    };

    const toggleRole = (role: UserRole) => {
        const currentRoles = formData.roles;
        if (currentRoles.includes(role)) {
            setFormData({ ...formData, roles: currentRoles.filter((r) => r !== role) });
        } else {
            setFormData({ ...formData, roles: [...currentRoles, role] });
        }
    };

    const toggleMenu = (menuId: string) => {
        const currentMenus = formData.allowedMenus;
        if (currentMenus.includes(menuId)) {
            setFormData({ ...formData, allowedMenus: currentMenus.filter((m) => m !== menuId) });
        } else {
            setFormData({ ...formData, allowedMenus: [...currentMenus, menuId] });
        }
    };

    const toggleCompany = (companyId: string) => {
        const currentCompanies = formData.allowedCompanyIds;
        if (currentCompanies.includes(companyId)) {
            setFormData({ ...formData, allowedCompanyIds: currentCompanies.filter((c) => c !== companyId) });
        } else {
            setFormData({ ...formData, allowedCompanyIds: [...currentCompanies, companyId] });
        }
    };

    const toggleSector = (sectorName: string) => {
        const currentSectors = formData.sectors;
        if (currentSectors.includes(sectorName)) {
            setFormData({ ...formData, sectors: currentSectors.filter((s) => s !== sectorName) });
        } else {
            setFormData({ ...formData, sectors: [...currentSectors, sectorName] });
        }
    };

    const filteredUsers = users?.filter((u) =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Usuários</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie usuários, papéis e permissões</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedUser(null);
                        setFormData(initialFormData);
                        setIsModalOpen(true);
                    }}
                    className="btn btn-primary flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Novo Usuário
                </button>
            </div>

            <div className="card">
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar usuários..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input pl-10 w-full"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Usuário</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Email</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Funções</th>
                                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : filteredUsers?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">
                                        Nenhum usuário encontrado
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers?.map((u) => (
                                    <tr key={u.id || u._id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                                                    <Users className="w-5 h-5" />
                                                </div>
                                                <p className="font-medium text-gray-900">{u.name}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{u.email}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {u.roles.filter(role => Object.values(UserRole).includes(role)).map((role) => (
                                                    <span key={role} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        {ROLE_LABELS[role] || role}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {u.isEmailVerified ? (
                                                <span className="inline-flex items-center text-success-600" title="Email Verificado">
                                                    <CheckCircle className="w-5 h-5" />
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-warning-500" title="Pendente Verificação">
                                                    <Clock className="w-5 h-5" />
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(u)}
                                                    className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {isMaster && (
                                                    <button
                                                        onClick={() => handleDelete(u.id || u._id || '')}
                                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">
                                {selectedUser ? 'Editar Usuário' : 'Novo Usuário'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Nome</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="label">Email</label>
                                    <input
                                        type="email"
                                        required
                                        disabled={!!selectedUser}
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="input w-full disabled:bg-gray-100"
                                    />
                                </div>
                                {(!selectedUser || isMaster) && (
                                    <div className="md:col-span-2">
                                        <label className="label">
                                            {selectedUser ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha'}
                                        </label>
                                        <input
                                            type="password"
                                            required={!selectedUser}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="input w-full"
                                            placeholder={selectedUser ? "Digite a nova senha se desejar alterar" : ""}
                                        />
                                    </div>
                                )}
                                <div className="md:col-span-2">
                                    <label className="label">Setores Responsáveis</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-lg">
                                        {activeCompany?.sectors?.map((s: any) => {
                                            const sectorName = typeof s === 'string' ? s : s.name;
                                            return (
                                                <label key={sectorName} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.sectors.includes(sectorName)}
                                                        onChange={() => toggleSector(sectorName)}
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-sm text-gray-700 truncate">{sectorName}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Selecione todos os setores que este usuário pode visualizar e gerenciar.
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Funções (Roles)
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {Object.values(UserRole).map((role) => (
                                        <label key={role} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.roles.includes(role)}
                                                onChange={() => toggleRole(role)}
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="text-sm text-gray-700">{ROLE_LABELS[role] || role}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {isMaster && (
                                <div className="border-t border-gray-100 pt-4">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <Building2 className="w-4 h-4" /> Acesso a Empresas
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                        {companies?.map((company) => (
                                            <label key={company.id || company._id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.allowedCompanyIds.includes(company.id || company._id || '')}
                                                    onChange={() => toggleCompany(company.id || company._id || '')}
                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-gray-700 truncate">{company.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-gray-100 pt-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Menu className="w-4 h-4" /> Permissões de Menu
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {AVAILABLE_MENUS.map((menu) => (
                                        <label key={menu.id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.allowedMenus.includes(menu.id)}
                                                onChange={() => toggleMenu(menu.id)}
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="text-sm text-gray-700">{menu.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="btn btn-primary"
                                >
                                    {createMutation.isPending || updateMutation.isPending
                                        ? 'Salvando...'
                                        : selectedUser
                                            ? 'Atualizar'
                                            : 'Criar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

