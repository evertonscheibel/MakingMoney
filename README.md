# MakingMoney (GestãoPro) 🚀

Uma plataforma corporativa de alto desempenho para gestão de processos recorrentes, projetada para maximizar a produtividade através de automação inteligente, gamificação e análise baseada em IA.

## 🌟 Principais Funcionalidades

- **Multi-Tenancy Avançado**: Isolamento completo de dados por empresa, com hierarquia de setores e permissões granulares.
- **Gestão de Ciclos Inteligente**: Automação de abertura e fechamento de ciclos mensais com clonagem inteligente de processos críticos.
- **Ecossistema de Gamificação**: Algoritmos personalizados que calculam pontuações baseadas em eficiência e cumprimento de prazos, estimulando o alto desempenho.
- **Assistente IA (Google Gemini)**: Chat integrado para análise preditiva, diagnóstico de atrasos e suporte à tomada de decisão.
- **Motor de Auditoria e Logs**: Rastreabilidade total de todas as ações no sistema para conformidade e segurança.
- **Simulação de Fluxos de Email**: Integração para monitoramento e validação de comunicações externas.
- **Dashboards em Tempo Real**: Visualização de KPIs, rankings de performance e curvas de evolução de processos.

## 🛠️ Stack Tecnológico

| Camada | Tecnologia |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Recharts, Vite |
| **Backend** | Node.js, Express, TypeScript, Mongoose |
| **Banco de Dados** | MongoDB (Document-oriented) |
| **Inteligência Artificial** | Google Gemini API |
| **Infraestrutura** | Docker, Docker Compose, Nginx (Reverse Proxy) |

## 📁 Estrutura do Projeto

```text
MakingMoney/
├── backend/           # API RESTful escalável
│   ├── src/
│   │   ├── controllers/ # Lógica de negócio e orquestração
│   │   ├── models/      # Modelagem de dados (Mongoose)
│   │   ├── routes/      # Endpoints da aplicação
│   │   └── services/    # Serviços externos (IA, Email)
├── frontend/          # Interface moderna e responsiva
│   └── src/
│       ├── components/  # Componentes reutilizáveis
│       ├── pages/       # Vistas principais da aplicação
│       └── contexts/    # Gestão de estado global
└── docker-compose.yml # Orquestração de containers
```

## 🚀 Guia de Inicialização Rápida

### Requisitos Prévios
- Node.js 20.x
- Docker & Docker Compose
- MongoDB 7.0 (se executado localmente)

### Execução via Docker (Recomendado)
```bash
docker-compose up --build
```
*O sistema estará disponível em http://localhost:80*

### Execução em Desenvolvimento (Windows)
1. Certifique-se de que o MongoDB está rodando.
2. Execute o script `iniciar-tudo.bat` no diretório raiz.

## 📊 Endpoints Estratégicos

- `POST /api/auth/login`: Autenticação segura via JWT.
- `GET /api/cycles/current`: Status do ciclo operacional atual.
- `POST /api/ai/chat`: Interface de comunicação com o assistente Gemini.
- `GET /api/reports/summary`: Sumarização executiva de performance.

---

## 📝 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

Desenvolvido com foco em eficiência e escalabilidade.
