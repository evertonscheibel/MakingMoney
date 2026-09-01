import { useState } from 'react';
import {
    HelpCircle,
    Search,
    ChevronDown,
    Building2,
    Layers,
    Users,
    ClipboardList,
    RefreshCcw,
    Settings,
    Award,
    BarChart3,
    Mail,
    AlertTriangle,
    CheckCircle2,
    Info,
} from 'lucide-react';

interface HelpStep {
    text: string;
}

interface HelpTopic {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    summary: string;
    roles?: string;
    steps: HelpStep[];
    conditions?: string[];
    tips?: string[];
}

const TOPICS: HelpTopic[] = [
    {
        id: 'empresas',
        icon: Building2,
        title: 'Empresas',
        summary: 'Cadastrar e gerenciar as empresas atendidas pelo sistema.',
        roles: 'Apenas usuários MASTER',
        steps: [
            { text: 'Acesse Configurações → Empresas no menu lateral.' },
            { text: 'Clique em "Nova Empresa".' },
            { text: 'Preencha nome, CNPJ (opcional), endereço, duração do contrato e modalidade.' },
            { text: 'Clique em "Criar Empresa". A empresa aparece na lista e no seletor de empresa no topo do menu.' },
        ],
        conditions: [
            'O nome da empresa não pode se repetir — o sistema bloqueia com erro se já existir uma empresa com o mesmo nome.',
            'Só usuários com papel MASTER enxergam e acessam esta tela.',
        ],
        tips: [
            'Depois de criar a empresa, cadastre os Setores dela antes de criar Usuários ou Processos — ambos dependem de setores existentes.',
        ],
    },
    {
        id: 'setores',
        icon: Layers,
        title: 'Setores',
        summary: 'Definir os setores/departamentos de uma empresa e seus gestores responsáveis.',
        roles: 'Apenas usuários MASTER',
        steps: [
            { text: 'Acesse Configurações → Setores.' },
            { text: 'Clique em "Novo Setor".' },
            { text: 'Digite o nome do setor (ex: Financeiro, RH, TI).' },
            { text: 'Opcionalmente, escolha um Gestor Responsável — ele receberá notificações de entregas do setor.' },
            { text: 'Clique em "Criar".' },
        ],
        conditions: [
            'Não é possível repetir o nome de um setor dentro da mesma empresa (o sistema ignora maiúsculas/minúsculas ao comparar).',
            'Os setores cadastrados aqui aparecem automaticamente nos formulários de Processos, Usuários e nos filtros do Dashboard.',
        ],
        tips: [
            'Também é possível criar um setor novo direto no formulário de "Novo Processo", clicando no "+" ao lado do campo Setor — não precisa sair da tela.',
        ],
    },
    {
        id: 'usuarios',
        icon: Users,
        title: 'Usuários',
        summary: 'Cadastrar pessoas, definir papéis (MASTER / GESTOR / OPERADOR) e permissões de menu.',
        roles: 'Apenas usuários MASTER',
        steps: [
            { text: 'Acesse Configurações → Usuários.' },
            { text: 'Clique em "Novo Usuário".' },
            { text: 'Preencha nome, e-mail, salário base (usado no cálculo de bônus) e senha.' },
            { text: 'Marque os Setores Responsáveis do usuário — definem quais processos ele vê e pode gerenciar.' },
            { text: 'Marque a(s) Função(ões): MASTER (acesso total), GESTOR (gerencia processos do seu setor) ou OPERADOR (executa e entrega processos).' },
            { text: 'Se MASTER, marque também as Empresas às quais ele terá acesso.' },
            { text: 'Marque as Permissões de Menu para usuários não-MASTER — controla quais itens aparecem no menu lateral deles.' },
            { text: 'Clique em "Criar Usuário".' },
        ],
        conditions: [
            'O e-mail deve ser único no sistema — não é possível cadastrar dois usuários com o mesmo e-mail.',
            'Usuários MASTER sempre têm acesso a tudo, independentemente das Permissões de Menu marcadas.',
            'As páginas de Empresas, Setores e Usuários são liberadas somente para MASTER — marcar essas permissões para outro papel não dá acesso a elas.',
        ],
    },
    {
        id: 'ciclos',
        icon: RefreshCcw,
        title: 'Ciclos Mensais',
        summary: 'O "ciclo" é o período mensal (ex: Setembro/2026) dentro do qual os processos de um setor são criados, entregues e avaliados.',
        roles: 'Abrir/fechar ciclo: GESTOR ou MASTER',
        steps: [
            { text: 'No Dashboard, selecione o setor desejado no filtro "Setor".' },
            { text: 'Se não houver ciclo aberto para o setor, aparece um aviso com o botão "Abrir Ciclo Inicial" — clique nele.' },
            { text: 'O mesmo aviso aparece na tela de Processos ao filtrar por um setor sem ciclo aberto, com o botão "Abrir Ciclo".' },
            { text: 'Ao final do mês, use o botão "Fechar Mês" (Dashboard ou Processos) para encerrar o ciclo do setor e, opcionalmente, abrir o próximo automaticamente.' },
        ],
        conditions: [
            'IMPORTANTE: não é possível criar um processo em um setor sem um ciclo aberto para ele — o sistema bloqueia a criação com o erro "Nenhum ciclo aberto para o setor".',
            'Cada setor tem seu próprio ciclo independente — abrir o ciclo do Financeiro não abre o do RH.',
            'Um ciclo fechado não pode receber novos processos nem edições nos processos existentes.',
            'Ciclos fechados ficam disponíveis para consulta em Histórico de Ciclos.',
        ],
    },
    {
        id: 'processos',
        icon: ClipboardList,
        title: 'Processos',
        summary: 'As tarefas/entregas recorrentes que cada setor executa todo mês.',
        roles: 'Criar/editar/excluir: GESTOR ou MASTER · Entregar: todos, inclusive OPERADOR',
        steps: [
            { text: 'Acesse Processos e clique em "Novo Processo".' },
            { text: 'Escolha o Setor (ou crie um novo direto ali, clicando no "+").' },
            { text: 'Preencha o Título, a Data Planejada e a Data Limite de entrega.' },
            { text: 'Opcionalmente, atribua um Operador Responsável.' },
            { text: 'Clique em "Salvar". O código do processo é gerado automaticamente.' },
            { text: 'Para registrar a entrega, clique no ícone de check verde na linha do processo, informe a data de entrega e confirme.' },
            { text: 'Depois de confirmada a entrega, é possível enviar o comprovante por e-mail pelo ícone de envelope.' },
        ],
        conditions: [
            'É preciso haver um ciclo aberto para o setor escolhido (veja o tópico "Ciclos Mensais") — sem isso, o formulário mostra erro ao salvar.',
            'A Data Limite não pode ser anterior à Data Planejada.',
            'Um código de processo não pode se repetir dentro do mesmo ciclo/setor.',
            'Só é possível excluir ou editar processos de um ciclo que ainda esteja aberto.',
            'Operadores só visualizam e entregam processos dos setores aos quais têm acesso; criar, editar e excluir processos é restrito a GESTOR/MASTER.',
        ],
        tips: [
            'Use "Importar Excel" para cadastrar vários processos de uma vez — a planilha precisa ter as colunas de código e nome do processo.',
        ],
    },
    {
        id: 'avaliacao',
        icon: Settings,
        title: 'Parâmetros de Avaliação',
        summary: 'Regras de pontuação usadas para avaliar se uma entrega foi antecipada, no prazo, atrasada ou crítica.',
        roles: 'Apenas usuários MASTER',
        steps: [
            { text: 'Acesse Configurações → Parâmetros de Avaliação.' },
            { text: 'Ajuste as notas para Entrega Antecipada, No Prazo, Primeira/Segunda Metade do Intervalo e Após Limite (Crítico).' },
            { text: 'Defina os Dias de Tolerância, se necessário.' },
            { text: 'Use o Simulador de Pontuação à direita para testar datas antes de salvar.' },
            { text: 'Clique em "Salvar Nova Versão".' },
        ],
        conditions: [
            'Salvar uma nova versão cria um novo conjunto de regras e não altera a pontuação de entregas já avaliadas — apenas as próximas.',
            'O histórico de versões anteriores fica disponível na mesma tela.',
        ],
    },
    {
        id: 'bonificacoes',
        icon: Award,
        title: 'Bonificações',
        summary: 'Cálculo trimestral do bônus de cada colaborador com base na pontuação média e no salário base.',
        roles: 'GESTOR ou MASTER',
        steps: [
            { text: 'Acesse Bonificações.' },
            { text: 'Escolha o Trimestre e o Ano.' },
            { text: 'Filtre por Setor e/ou Operador, se quiser um recorte específico.' },
            { text: 'Escolha o Modo de Cálculo: Performance Individual ou por Setor.' },
            { text: 'Consulte o detalhamento por colaborador e exporte em PDF, se necessário.' },
        ],
        conditions: [
            'O setor só libera o bônus quando a média trimestral atinge 75% ou mais.',
            'O cálculo depende do Salário Base cadastrado em cada usuário — sem ele, o valor do bônus fica zerado.',
        ],
    },
    {
        id: 'relatorios',
        icon: BarChart3,
        title: 'Relatórios e Curva de Processo',
        summary: 'Indicadores consolidados de entregas no prazo, atrasos e criticidade, com extrato detalhado e exportação em PDF.',
        roles: 'Todos os papéis (o conteúdo mostrado respeita os setores de acesso de cada usuário)',
        steps: [
            { text: 'Acesse Relatórios para ver KPIs e o extrato detalhado por setor.' },
            { text: 'Acesse Curva de Processo para comparar planejado x realizado dia a dia dentro do mês.' },
            { text: 'Use os filtros de Setor, Ciclo e Status para refinar a visão.' },
            { text: 'Clique em "Exportar PDF" para baixar o relatório atual.' },
        ],
    },
    {
        id: 'email',
        icon: Mail,
        title: 'Configuração de E-mail (SMTP)',
        summary: 'Servidor de e-mail usado para enviar notificações automáticas e comprovantes de entrega.',
        roles: 'Apenas usuários MASTER',
        steps: [
            { text: 'Acesse Configurações → Config. Email.' },
            { text: 'Preencha Host, Porta, Usuário e Senha do servidor SMTP.' },
            { text: 'Defina o Nome e o E-mail do remetente.' },
            { text: 'Adicione os destinatários padrão que devem receber notificações de entregas.' },
            { text: 'Use "Testar Conexão" antes de salvar para confirmar que os dados estão corretos.' },
            { text: 'Clique em "Salvar Configuração".' },
        ],
        conditions: [
            'Sem uma configuração de e-mail válida, os envios automáticos de comprovantes de entrega falham silenciosamente — sempre teste a conexão após configurar.',
            'Deixar o campo de senha em branco ao editar mantém a senha atual salva.',
        ],
    },
];

export default function Help() {
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState<string | null>('ciclos');

    const filtered = TOPICS.filter((t) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            t.title.toLowerCase().includes(q) ||
            t.summary.toLowerCase().includes(q) ||
            t.steps.some((s) => s.text.toLowerCase().includes(q)) ||
            t.conditions?.some((c) => c.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    Central de Ajuda
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Passo a passo de cada funcionalidade do Método Chronos e as condições necessárias para usá-las.
                </p>
            </div>

            <div className="card dark:bg-gray-800 dark:border-gray-700">
                <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por assunto (ex: ciclo, setor, bônus)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input pl-10 w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card dark:bg-gray-800 dark:border-gray-700 text-center py-8 text-gray-500 dark:text-gray-400">
                    Nenhum tópico encontrado para "{search}".
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((topic) => {
                        const isOpen = openId === topic.id;
                        const Icon = topic.icon;
                        return (
                            <div
                                key={topic.id}
                                className="card dark:bg-gray-800 dark:border-gray-700 p-0 overflow-hidden"
                            >
                                <button
                                    onClick={() => setOpenId(isOpen ? null : topic.id)}
                                    className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 flex-shrink-0 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 dark:text-white">{topic.title}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{topic.summary}</p>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {isOpen && (
                                    <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-4">
                                        {topic.roles && (
                                            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-500" />
                                                <span><strong>Quem pode:</strong> {topic.roles}</span>
                                            </div>
                                        )}

                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Passo a passo</h4>
                                            <ol className="space-y-2">
                                                {topic.steps.map((step, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 text-xs font-semibold flex items-center justify-center mt-0.5">
                                                            {i + 1}
                                                        </span>
                                                        {step.text}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>

                                        {topic.conditions && topic.conditions.length > 0 && (
                                            <div className="rounded-lg border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-900/20 p-3">
                                                <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" /> Condições e pontos de atenção
                                                </h4>
                                                <ul className="space-y-1.5">
                                                    {topic.conditions.map((c, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-300/90">
                                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-orange-500 flex-shrink-0" />
                                                            {c}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {topic.tips && topic.tips.length > 0 && (
                                            <div className="rounded-lg border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/20 p-3">
                                                <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" /> Dica
                                                </h4>
                                                <ul className="space-y-1.5">
                                                    {topic.tips.map((t, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-green-800 dark:text-green-300/90">
                                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                                                            {t}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
