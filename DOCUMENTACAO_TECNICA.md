# CHRONOS - Documentação Técnica do Sistema
Versão: 1.3.0 | Projeto: Making Money Method

## 1. VISÃO GERAL E ARQUITETURA

O **Chronos** é um sistema de gestão de performance operacional focado no monitoramento de processos (PAC), scoring de entregas e cálculo de bonificação variável.

### Stack Tecnológica
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript.
- **Banco de Dados**: MongoDB 7.0 (via Mongoose).
- **IA**: Google Gemini (gemini-2.0-flash-exp).
- **E-mail**: MailHub (Nodemailer + SMTP).
- **Infraestrutura**: Docker (Docker Compose), Nginx (Reverse Proxy/Static Hosting).

### Estrutura de Pastas (Tree View Resumida)
```text
.
├── backend/
│   ├── src/
│   │   ├── controllers/    # Lógica de negócio por endpoint
│   │   ├── models/         # Schemas Mongoose
│   │   ├── middleware/     # Auth, Erros, Auditoria
│   │   ├── routes/         # Definição de rotas Express
│   │   ├── services/       # E-mail, IA, Integrações
│   │   ├── types/          # Interfaces TypeScript Globais
│   │   └── utils/          # Helpers e algoritmos de scoring
├── frontend/
│   ├── src/
│   │   ├── api/            # Cliente Axios/React Query
│   │   ├── components/     # UI Reutilizável
│   │   ├── contexts/       # Auth, Theme
│   │   ├── pages/          # Telas principais
│   │   └── types/          # Tipagem compartilhada
├── srcb/                   # Versão Homologação (Backend) - Contém Módulo Industrial
└── srcf/                   # Versão Homologação (Frontend) - Contém Escala de Abate
```

### Topologia de Infraestrutura
O sistema utiliza uma arquitetura de microsserviços conteinerizada:
1. **gestaopro-mongodb**: Banco de dados NoSQL persistente.
2. **gestaopro-backend**: API Node.js processando lógica e integrações (Porta 3001).
3. **gestaopro-frontend**: Servidor React (Porta 5173 externa, 80 interna).
4. **Rede Docker**: `gestaopro-network` (bridge) para comunicação interna.

---

## 2. MODELAGEM DE DADOS (DATABASE)

O banco de dados é estruturado em torno da hierarquia: **Empresa > Ciclo > Processo**.

### Principais Schemas (Mongoose)

#### **Company (Empresas)**
- Armazena dados cadastrais e a lista de **Setores** disponíveis.
- `sectors`: Array de objetos `{ name: string, managerId: ObjectId }`.

#### **User (Usuários)**
- `roles`: `master`, `manager`, `operator`.
- `companyAccess`: Mapeamento de quais empresas o usuário acessa e seu cargo em cada uma.
- `baseSalary`: Salário bruto para cálculo de bônus.

#### **Cycle (Ciclos/Meses)**
- Representa o fechamento mensal por setor.
- `month`: Formato `YYYY-MM`.
- `kpis`: Snapshot de performance (`avgScore`, `onTimePct`, `criticalCount`).

#### **Process (Processos/PAC)**
- Unidade fundamental de monitoramento.
- `code`: ID numérico sequencial por setor (ex: 001).
- `plannedDate`, `limitDate`: Datas de referência para scoring.
- `deliveryStatus`: `NOT_DELIVERED`, `CONFIRMED_PENDING_EMAIL`, `EMAIL_SENT`.
- `score`: Valor calculado (0-100).

#### **AuditLog (Auditoria)**
- Registra `before` e `after` de qualquer alteração crítica, incluindo IP e UserAgent.

---

## 3. REGRAS DE NEGÓCIO E FLUXOS

### Gestão de Ciclos (PAC)
1. **Abertura**: O sistema cria um ciclo para um `Setor + Mês`.
2. **Clonagem**: Ao fechar um ciclo, os processos pendentes e recorrentes são clonados para o mês seguinte, reajustando as datas (`plannedDate`) mantendo o mesmo dia do mês.
3. **Reset/Restore**: Permite desfazer o fechamento criando um `CycleRestorePoint` (snapshot total).

### Algoritmo de Scoring
A pontuação de um processo é definida pela proximidade da entrega em relação à data planejada e limite:
- **Entrega Antecipada**: 100 pontos.
- **Entrega no Prazo (Data Planejada)**: 75 pontos.
- **Primeira Metade do Intervalo (Atraso Leve)**: 50 pontos.
- **Segunda Metade do Intervalo (Atraso Moderado)**: 25 pontos.
- **Após Data Limite + Tolerância**: 0 pontos (Crítico).

---

## 4. MÓDULO INDUSTRIAL (BASEADO EM HOMOLOGAÇÃO)

O Módulo Industrial opera sobre a infraestrutura do PAC, mas com interfaces e campos especializados.

### Escala de Abate
- **Lógica**: Utiliza o controlador `schedule.controller` para gerar um **Cronograma Global**.
- **Visualização**: Calendário tipo Gantt que mapeia "Lotes de Abate" em uma linha do tempo mensal.
- **Sincronização**: Alterações na Escala de Abate refletem automaticamente nos registros de inspeção.

### Fechamento SIF (Serviço de Inspeção Federal)
- **Campos Específicos**: Integração de dados de **Curral, NF (Nota Fiscal) e GTA (Guia de Trânsito Animal)**.
- **Auditoria**: O sistema garante que dados inseridos manualmente não sejam sobrescritos durante atualizações automáticas da escala de abate.
- **Status SIF**: Os processos do setor SIF possuem um fluxo de confirmação rígido antes de permitir o envio do e-mail de fechamento para a diretoria.

---

## 5. CÁLCULOS MATEMÁTICOS E BÔNUS

### Bônus de Performance Trimestral
O cálculo é baseado na média de scores do trimestre e no salário do colaborador.

1. **Elegibilidade do Setor**: O bônus só é liberado se a média do **Setor** no trimestre for **>= 75%**.
2. **Base de Cálculo**: `Salário Trimestral = BaseSalary / 4`.
3. **Modos de Cálculo**:
   - **INDIVIDUAL**: `Bônus = (Média_Individual / 100) * Salário_Trimestral`.
   - **SETOR**: `Bônus = (Média_Setor / 100) * Salário_Trimestral`.
4. **Fórmula Consolidada**:
   `BonusValue = (AppliedScore / 100) * (BaseSalary / 4)`

---

## 6. INTEGRAÇÕES (MAILHUB & IA)

### MailHub (SMTP/E-mail)
- **Fluxo**: Os e-mails são enfileirados na `EmailQueue` para processamento assíncrono.
- **Configuração**: Suporte a SSL/TLS, STARTTLS e máscaras de envio personalizadas por empresa.
- **LGPD**: Inclusão automática de rodapés de transparência e metadados de rastreio.

### Assistente de IA (Gemini)
- **Modelo**: `gemini-2.0-flash-exp`.
- **Contexto Dinâmico**: O sistema injeta automaticamente os KPIs atuais (Score Médio, % Entrega, Processos Críticos) no prompt para que a IA possa fornecer análises preditivas reais sobre a operação.

---

## 7. MAPEAMENTO DE API (ENDPOINTS)

| Módulo | Endpoint | Método | Descrição |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/login` | POST | Autenticação e geração de JWT |
| **Ciclos** | `/api/cycles/open` | POST | Abre novo mês para um setor |
| **Processos** | `/api/processes/:id/deliver` | PUT | Registra entrega e gera score |
| **Industrial** | `/api/schedule` | GET | Retorna escala de abate (Homolog) |
| **Bônus** | `/api/bonus/report` | GET | Relatório trimestral de valores |
| **IA** | `/api/ai/chat` | POST | Análise de dados via Gemini |
| **Logs** | `/api/logs/system` | GET | Visualização da trilha de auditoria |

---

## 8. DIFERENÇAS DE VERSÃO: PRODUÇÃO VS HOMOLOGAÇÃO

### Versão Produção (`backend/src`, `frontend/src`)
- Foco em PAC e Qualidade.
- Sistema de Bonificação por Salário Base (Trimestral).
- IA Gemini totalmente integrada.
- Auditoria de alta granularidade (Antes/Depois).

### Versão Homologação (`srcb`, `srcf`)
- **Módulo Industrial Ativo**: Contém as rotas `/schedule` e componentes de Escala de Abate.
- **SIF**: Lógica de sincronização Curral/GTA/NF ativa.
- **Legacy Bonus**: Sistema de bônus baseado em valor fixo (baseValue), sem vínculo salarial.

---
**Documentação gerada automaticamente para o Projeto Chronos.**
