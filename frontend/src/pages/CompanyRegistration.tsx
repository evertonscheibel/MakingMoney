import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesApi } from '../api';
import { useAuth } from '../contexts';
import {
    Building2,
    Plus,
    Search,
    Edit2,
    Trash2,
    XCircle,
    FileText,
} from 'lucide-react';
import { UserRole, Company } from '../types';

interface CompanyFormData {
    name: string;
    cnpj: string;
    street: string;
    number: string;
    city: string;
    state: string;
    zipCode: string;
    contractDuration: number;
    modality: string;
}

const initialFormData: CompanyFormData = {
    name: '',
    cnpj: '',
    street: '',
    number: '',
    city: '',
    state: '',
    zipCode: '',
    contractDuration: 12,
    modality: 'Padrão',
};

export default function CompanyRegistration() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [formData, setFormData] = useState<CompanyFormData>(initialFormData);

    const isMaster = user?.roles.includes(UserRole.MASTER);

    const { data: companies, isLoading } = useQuery({
        queryKey: ['companies'],
        queryFn: () => companiesApi.list(),
    });

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => queryClient.ensureQueryData({
            queryKey: ['users'],
            queryFn: () => import('../api').then(api => api.usersApi.list())
        }),
        enabled: isMaster && isModalOpen,
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => companiesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companies'] });
            setIsModalOpen(false);
            setFormData(initialFormData);
            alert('Empresa criada com sucesso!');
        },
        onError: (error: any) => {
            alert(`Erro ao criar empresa: ${error.response?.data?.message || error.message}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => companiesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companies'] });
            setIsModalOpen(false);
            setSelectedCompany(null);
            setFormData(initialFormData);
            alert('Empresa atualizada com sucesso!');
        },
        onError: (error: any) => {
            alert(`Erro ao atualizar empresa: ${error.response?.data?.message || error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => companiesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companies'] });
            alert('Empresa removida com sucesso!');
        },
    });

    if (!isMaster) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Acesso Negado</h2>
                    <p className="text-gray-500">Apenas usuários MASTER podem acessar esta página.</p>
                </div>
            </div>
        );
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            name: formData.name,
            cnpj: formData.cnpj.replace(/\D/g, ''),
            address: {
                street: formData.street,
                number: formData.number,
                city: formData.city,
                state: formData.state,
                zipCode: formData.zipCode,
            },
            contractDuration: Number(formData.contractDuration),
            modality: formData.modality,
        };

        if (selectedCompany) {
            updateMutation.mutate({ id: (selectedCompany.id || selectedCompany._id) as string, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleEdit = (company: Company) => {
        setSelectedCompany(company);
        setFormData({
            name: company.name,
            cnpj: company.cnpj || '',
            street: company.address?.street || '',
            number: company.address?.number || '',
            city: company.address?.city || '',
            state: company.address?.state || '',
            zipCode: company.address?.zipCode || '',
            contractDuration: company.contractDuration || 12,
            modality: company.modality || 'Padrão',
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta empresa?')) {
            deleteMutation.mutate(id);
        }
    };

    const filteredCompanies = companies?.filter((company) =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestão de Empresas</h1>
                    <p className="text-gray-500">Cadastre e gerencie as empresas do sistema</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedCompany(null);
                        setFormData(initialFormData);
                        setIsModalOpen(true);
                    }}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nova Empresa
                </button>
            </div>

            <div className="card">
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar empresas..."
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
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Empresa</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">CNPJ</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Cidade/UF</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contrato</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : filteredCompanies?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">
                                        Nenhuma empresa encontrada
                                    </td>
                                </tr>
                            ) : (
                                filteredCompanies?.map((company) => (
                                    <tr key={company.id || company._id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{company.name}</p>
                                                    <p className="text-xs text-gray-500">{company.sectors.length} setores</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {company.cnpj || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {company.address?.city ? `${company.address.city}/${company.address.state}` : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            <div>
                                                <p>{company.modality || 'Padrão'}</p>
                                                <p className="text-xs text-gray-500">{company.contractDuration || 12} meses</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            {company.isActive ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Inativo
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(company)}
                                                    className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete((company.id || company._id) as string)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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
                                {selectedCompany ? 'Editar Empresa' : 'Nova Empresa'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Nome da Empresa</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="label">CNPJ</label>
                                    <input
                                        type="text"
                                        value={formData.cnpj}
                                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                                        className="input w-full"
                                        placeholder="00.000.000/0000-00"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Building2 className="w-4 h-4" /> Endereço
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="label">Rua</label>
                                        <input
                                            type="text"
                                            value={formData.street}
                                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                            className="input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Número</label>
                                        <input
                                            type="text"
                                            value={formData.number}
                                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                            className="input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Cidade</label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            className="input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Estado</label>
                                        <input
                                            type="text"
                                            value={formData.state}
                                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                            className="input w-full"
                                            maxLength={2}
                                            placeholder="UF"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">CEP</label>
                                        <input
                                            type="text"
                                            value={formData.zipCode}
                                            onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                            className="input w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Contrato
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Duração (meses)</label>
                                        <input
                                            type="number"
                                            value={formData.contractDuration}
                                            onChange={(e) => setFormData({ ...formData, contractDuration: Number(e.target.value) })}
                                            className="input w-full"
                                            min={1}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Modalidade</label>
                                        <select
                                            value={formData.modality}
                                            onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                                            className="input w-full"
                                        >
                                            <option value="Padrão">Padrão</option>
                                            <option value="Premium">Premium</option>
                                            <option value="Enterprise">Enterprise</option>
                                        </select>
                                    </div>
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
                                        : selectedCompany
                                            ? 'Atualizar'
                                            : 'Criar Empresa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

