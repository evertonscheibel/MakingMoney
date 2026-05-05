# 💰 MakingMoney — Automação de Processos e Marketing Digital

Sistema completo de automação de ciclos de negócios, focado em gestão de processos, campanhas de e-mail marketing e monitoramento de performance.

![Status](https://img.shields.io/badge/status-active-success.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v18%2B-green.svg)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)

## 🌟 Funcionalidades

- **📧 Engine de E-mail Marketing**: Gestão de filas (`EmailQueue`), configurações de SMTP e rastreamento de eventos de entrega/abertura.
- **🔄 Gestão de Ciclos de Negócio**: Automação de processos repetitivos com suporte a pontos de restauração (`RestorePoints`).
- **📊 Avaliação de Performance**: Módulo de configuração de avaliações para medir resultados de processos.
- **🛡️ Auditoria Completa**: Logs detalhados de atividades para rastreabilidade total de alterações.
- **🏢 Gestão Multi-empresa**: Suporte para múltiplas organizações em uma única instância.

## 🛠️ Stack Tecnológica

- **Backend**: Node.js com TypeScript (NestJS/Express pattern).
- **Frontend**: React com TypeScript e Vite.
- **Infraestrutura**: Docker Compose para orquestração de serviços.
- **Logs**: Sistema robusto de auditoria e monitoramento.

## 📁 Estrutura do Projeto

- `/backend`: Core da aplicação e lógica de automação.
- `/frontend`: Interface administrativa e dashboards.
- `docker-compose.yml`: Configuração de banco de dados e serviços auxiliares.

## 🚀 Como Iniciar

### Pré-requisitos
- Node.js 18+
- Docker & Docker Compose

### Instalação

1. **Subir Serviços (DB/Redis)**:
   ```bash
   docker-compose up -d
   ```

2. **Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---
Desenvolvido por **Everton Scheibel**
