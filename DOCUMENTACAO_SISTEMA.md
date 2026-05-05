# Documentação Completa do Sistema - Método Chronos

Este documento fornece uma visão detalhada de todas as funcionalidades e módulos do sistema **Método Chronos**, uma plataforma de gestão de performance, processos (PAC) e indicadores industriais.

---

## 1. Visão Geral
O sistema foi projetado para automatizar o acompanhamento de processos operacionais, calcular indicadores de desempenho (KPIs) em tempo real e gerenciar a bonificação de colaboradores com base em meritocracia técnica.

### Níveis de Acesso
*   **MASTER:** Acesso total a todas as empresas, configurações e logs do sistema.
*   **GERENTE:** Gestão de setores específicos, fechamento de ciclos e visualização de relatórios avançados.
*   **OPERADOR:** Focado na execução de processos, visualização de metas e desempenho individual.

---

## 2. Dashboard e Indicadores (KPIs)
O Dashboard é a central de comando para gestores e operadores.

*   **Indicadores de Ciclo:** Visualização rápida do total de processos, porcentagem no prazo, contagem de atrasados e itens críticos.
*   **Benchmarking de Performance:** Comparação da pontuação média do usuário atual versus a média da equipe (Benchmark).
*   **Gestão de Ciclos (Meses):**
    *   **Abertura de Ciclo:** Inicia um novo período de medição para um setor.
    *   **Fechamento de Mês:** Processa os resultados, aplica as regras de pontuação e opcionalmente clona processos recorrentes para o mês seguinte.
    *   **Reset e Restauração:** Permite reiniciar um mês em caso de erro, com ponto de restauração para segurança.
    *   **Reabertura:** Possibilidade de reabrir um ciclo fechado para ajustes finos.

---

## 3. Gestão de Processos (PAC - Programa de Autocontrole)
Módulo central para a operação do dia a dia.

*   **Listagem Inteligente:** Filtros por status (No Prazo, Atrasado, Crítico), setor, responsável e busca textual.
*   **Execução de Entregas:** Registro de data de entrega, anexos (documentos/evidências) e observações.
*   **Importação em Massa:** Ferramenta para importar centenas de processos via planilha Excel/CSV, facilitando a implantação inicial.
*   **Automação de E-mail:** Envio automático de confirmações de entrega e notificações de status.
*   **Reversão de Entrega:** Permite desfazer uma entrega registrada incorretamente com justificativa auditada.
*   **Cálculo de Pontuação:** Cada entrega é pontuada automaticamente com base na proximidade entre a data de entrega e as datas planejada/limite.

---

## 4. Relatórios e Análises
Transformação de dados operacionais em insights estratégicos.

*   **Relatório de Bonificações:**
    *   Cálculo baseado no salário base de cada colaborador.
    *   Suporte a diferentes modos de cálculo (Trimestral, Mensal).
    *   Exportação de dados para folha de pagamento.
*   **Curva de Processo:** Análise de tendência que mostra a evolução da performance ao longo do tempo por setor ou usuário.
*   **Ranking de Setores:** Comparativo de desempenho entre diferentes áreas da empresa.
*   **Extrato de Ciclo:** Visão detalhada de todos os eventos ocorridos em um período específico.

---

## 5. Administração e Configurações
Ferramentas para garantir a integridade e personalização do sistema.

*   **Gestão de Usuários:** Cadastro, definição de papéis (Roles) e vinculação a setores.
*   **Multi-Empresa e Setores:** Suporte a múltiplas unidades de negócio com isolamento de dados.
*   **Parâmetros de Avaliação:** Configuração personalizada das regras de pontuação (pesos para entregas no prazo, atrasadas ou críticas).
*   **Configuração de E-mail (SMTP):** Gestão dos servidores de envio de notificações e testes de conectividade.
*   **Assistente de IA (Chronos AI):** Chat integrado que utiliza inteligência artificial para responder dúvidas sobre indicadores e processos do sistema.

---

## 6. Auditoria e Segurança
*   **Logs de Auditoria:** Registro detalhado de quem alterou o quê e quando (Entity Logs).
*   **Logs de E-mail:** Rastreabilidade total de todas as comunicações enviadas pelo sistema, incluindo status de entrega.
*   **Segurança de Acesso:** Fluxos completos de recuperação de senha, verificação de e-mail e proteção de rotas por nível de permissão.

---

## 7. Fluxo de Trabalho Sugerido
1.  **Configuração:** Cadastro da empresa, setores e usuários.
2.  **Planejamento:** Importação ou criação dos processos recorrentes.
3.  **Operação:** Colaboradores registram as entregas conforme executam as tarefas.
4.  **Monitoramento:** Gestores acompanham o Dashboard e indicadores de desempenho.
5.  **Fechamento:** No final do mês, o ciclo é fechado, gerando os indicadores para bonificação e preparando o próximo período.

---
*Documento gerado em 26 de Abril de 2026.*
