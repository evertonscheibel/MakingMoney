# CHRONOS — Plano técnico de correções e evolução

**Versão:** 1.3 — estados, cobertura e evolução gerencial implementados localmente  
**Data:** 29/10/2026  
**Status:** CHR-001 a CHR-007 implementados localmente; homologação humana e conferência do legado pendentes. CHR-008 adiado.  
**Origem:** Observações de demonstração operacional do Método Chronos.

> **Escopo atual:** implementação e testes locais, com consulta somente de leitura à cópia importada da VPS. Etapas anteriores de diagnóstico e suas limitações estão preservadas abaixo como histórico. A seção 14 registra o que foi entregue nesta continuação. Nenhum deploy, recálculo de snapshots ou migração automática do legado foi executado. Dependências entre processos permanecem adiadas.

## 1. Objetivo

Garantir integridade das avaliações e permitir análise histórica de desempenho por colaborador, setor e processo, contextualizada pelo volume de processos, cobertura de avaliações e eventos de implantação.

## 2. Escopo e prioridades

| ID | Prioridade | Entrega | Situação local |
|---|---|---|---|
| CHR-001 | P0 | Auditar regras atuais de pontuação e agregação | Diagnóstico e casos reproduzíveis concluídos; origem do relato 175 não comprovada, escala 0–100 preservada |
| CHR-002 | P0 | Normalizar estados de avaliação | Estados derivados, filtros, legenda e aplicabilidade com motivo implementados |
| CHR-003 | P0 | Corrigir denominadores e cobertura | Nota, entregas e cobertura separados; ausência vencida permanece no denominador exigível |
| CHR-004 | P1 | Evolução mensal/trimestral | Série por ciclo, amostra, meses avaliados, lacunas e variação implementados |
| CHR-005 | P1 | Volume de processos × desempenho | Gráfico conjunto, volumes por competência e filtros implementados |
| CHR-006 | P1 | Marcos de implantação | Linha do tempo por evidência, autoria, filtros e registro manual implementados |
| CHR-007 | P2 | Comparação de carteira equivalente | Identidades comprovadas, exclusões e vínculo manual com prévia implementados; legado depende de conferência humana |
| CHR-008 | P3 | Dependências entre processos | Adiado conforme decisão do usuário |

## 3. Regras de negócio propostas (sujeitas a homologação)

### 3.1 Estados por processo/período

- `AVALIADO`: existe avaliação válida e consolidável.
- `PENDENTE`: avaliação esperada, ainda dentro do prazo.
- `SEM_AVALIACAO`: avaliação exigível e ausente após prazo.
- `NAO_APLICAVEL`: processo não elegível no período, com motivo.
- `INATIVO`: condição do cadastro, separada do estado da avaliação, preservando histórico.
- `TRANSFERIDO`: evento de troca de responsável; não substituir o estado da avaliação do período.

**Regra:** transferência é evento de responsabilidade, não pontuação. Definir data de vigência e responsável de cada competência.

### 3.2 Médias e amostragem

- Média do período = soma das pontuações válidas / quantidade de avaliações válidas, **somente se** a regra atual utilizar média aritmética simples. Caso haja pesos, preservar a fórmula ponderada homologada.
- Uma única avaliação válida pode produzir média numérica, mas deve mostrar `n=1` e alerta de amostra reduzida.
- Período sem avaliações válidas: retornar `sem dados` (`null`), **nunca zero automaticamente**.
- `NAO_APLICAVEL` e períodos anteriores à ativação não entram no denominador de avaliações exigíveis.
- `SEM_AVALIACAO` não entra na média de notas, mas entra na apuração de cobertura e inadimplência de avaliações.
- **Cobertura (%)** = avaliações exigíveis concluídas / avaliações exigíveis totais × 100.
- Não misturar pontuação de desempenho com cobertura de avaliação em um único percentual sem fórmula explícita.
- A escala implementada é de 0 a 100, tanto em `Process.score` quanto nos parâmetros de avaliação. O relato de 175 exige rastrear a tela, unidade e cálculo de origem; não ampliar a escala nem truncar dados para acomodar esse exemplo. Pode representar soma ou outro indicador, ainda não identificado.

### 3.3 Consolidação trimestral

- Registrar se o trimestre utiliza média das avaliações, média das médias mensais ou média ponderada; essas fórmulas podem produzir resultados diferentes.
- Exibir meses válidos e quantidade de avaliações (`n`).
- Permitir comparação de trimestres com alertas quando a composição dos processos mudar.
- Exemplo relatado: 1º trimestre = 85%; 2º trimestre = 94%; variação = **+9 pontos percentuais**, não +9% de crescimento relativo.

## 4. Requisitos de interface e indicadores

### CHR-002 — Status e legenda
- Exibir estado textual, cor e tooltip; não depender exclusivamente da cor rosa.
- Filtros de avaliação: sem avaliação e avaliados; situação cadastral: ativos/inativos; transferência: evento próprio. Não aplicável depende de modelagem e regra aprovadas. Não adicionar esses valores diretamente ao enum `ProcessStatus` existente.
- Preservar histórico ao alterar responsável ou desativar processo.

### CHR-004 — Curva de desempenho
- Série por mês e trimestre, por colaborador/setor/processo.
- Exibir valores, quantidade de avaliações e cobertura por ponto.
- Indicar variação absoluta e em pontos percentuais quando aplicável.
- Tratar lacunas como ausência de dados, sem interpolação silenciosa.

### CHR-005 — Carga operacional
- Mostrar por período: processos ativos, exigíveis, avaliados, novas inclusões e transferências.
- Cruzar volume e desempenho sem inferir causalidade.
- Permitir filtrar colaborador, setor, competência e categoria.

### CHR-006 — Eventos históricos
- Registrar implantação, ativação, inclusão, transferência, alteração de pesos/regras e desativação.
- Mostrar eventos na linha do tempo com autor, data, descrição e referência.

### CHR-007 — Comparação equivalente
- Oferecer opção para comparar apenas processos elegíveis nos dois períodos.
- Exibir tamanho da carteira comum e itens excluídos.

### CHR-008 — Dependências (fase futura)
- Modelar relações `processo_origem -> processo_dependente`, com tipo e vigência.
- Impedir ciclos indevidos conforme regra do negócio.
- Registrar atrasos e impactos sem atribuir culpa automaticamente.

## 5. Modelo de dados — proposta conceitual futura

O sistema usa MongoDB/Mongoose, não um esquema relacional. Já existem `Process`, `Cycle`, `EvaluationConfig` e `AuditLog`. Cada processo pertence a um ciclo mensal de setor e é clonado para o ciclo seguinte. Não criar uma coleção de avaliações para duplicar `score`/`deliveryDate` sem necessidade comprovada. Os nomes abaixo são conceitos, não migração pronta.

```text
processo(id, setor_id, status, ativo_desde, inativo_em, ...)
responsabilidade_processo(id, processo_id, colaborador_id, inicio, fim, motivo)
avaliacao(id, processo_id, colaborador_id, competencia, nota, status, avaliado_em, ...)
exigibilidade_avaliacao(id, processo_id, competencia, exigivel, motivo, prazo)
evento_processo(id, processo_id, tipo, ocorrido_em, autor_id, metadados)
dependencia_processo(id, origem_id, dependente_id, tipo, inicio, fim)
```

**Não criar tabelas duplicadas antes de mapear o esquema atual.** Preferir migrações versionadas, índices por competência/processo/responsável e trilha de auditoria.

## 6. Plano de execução

### Etapa A — Diagnóstico (antes de codificar)
- [x] Localizar serviços de cálculo de desempenho e agregação trimestral (seção 10).
- [x] Identificar consultas dos gráficos e filtros por inspeção estática.
- [x] Mapear estados existentes e regras de exclusão no código; aparência visual ainda não homologada.
- [ ] Levantar casos reais anonimizados: processo com 1 mês, sem nota, inativo e transferido.
- [ ] Comparar resultado atual com cálculo manual e documentar divergências.
- [ ] Validar com o responsável pelo produto o tratamento de notas acima de 100 e pesos.

### Etapa B — Correção de consistência
- [x] Escrever testes automatizados para regras locais adotadas.
- [x] Ajustar agregações e denominadores.
- [x] Separar status de avaliação de eventos de transferência.
- [x] Exibir amostra e cobertura nos indicadores.
- [x] Conferir compatibilidade técnica com relatórios legados; homologação humana permanece pendente.

### Etapa C — Inteligência gerencial
- [x] Implementar curva histórica e comparação trimestral.
- [x] Adicionar volume de processos e variação por período.
- [x] Adicionar marcos de implantação.
- [x] Criar comparação por carteira equivalente, com exclusões e qualidade do vínculo explícitas.

### Etapa D — Evolução futura
- [ ] Especificar dependências e análise de impacto.
- [ ] Construir protótipo, testar com usuários e medir utilidade.

## 7. Cenários mínimos de teste

| Cenário | Resultado esperado |
|---|---|
| Apenas 1 mês avaliado no trimestre | Média calculada conforme fórmula aprovada, `n=1`, alerta de amostra |
| Nenhum mês avaliado | `sem dados`, sem falsa nota zero |
| Avaliação exigível ausente | Cobertura reduzida; ausência visível |
| Processo não aplicável | Fora do denominador de exigibilidade, motivo auditável |
| Processo transferido no meio do mês | Atribuição segue vigência/regra aprovada; histórico preservado |
| Processo desativado | Não exige avaliações futuras; histórico anterior intacto |
| Nota 175 | Escala e interpretação exibidas sem truncamento indevido |
| Trimestre 85% vs. 94% | Exibe +9 pontos percentuais |
| Inclusão de muitos processos | Gráfico identifica mudança na composição da carteira |
| Períodos com carteiras diferentes | Comparação sinalizada; filtro de carteira comum disponível |

## 8. Critérios de conclusão

- [ ] Fórmulas e decisões de negócio aprovadas pelo responsável.
- [ ] Testes unitários e de integração passando.
- [ ] Migrações reversíveis e backup realizado antes de alterações em produção.
- [ ] Indicadores validados contra amostra manual.
- [ ] Sem regressão em permissões, pontuação, histórico e exportações.
- [ ] Homologação por usuário-chave registrada.

## 9. Prompt de execução para agente de desenvolvimento

> Implemente localmente o lote explicitamente solicitado da seção 12. Releia as instruções do projeto, o diff atual e os arquivos afetados antes de editar; preserve alterações existentes do usuário. Use o diagnóstico da seção 10 como ponto de partida, confirmando que continua válido. Trabalhe em `backend/src` e `frontend/src`; não modifique cópias `srcb`, `srcf` ou arquivos compilados como fonte. Comece por testes de caracterização com dados sintéticos no MongoMemoryServer e compare os mesmos registros entre resumo, ranking, métricas, fechamento manual e automático, histórico e bônus. Não conecte testes ao banco operacional, não execute seeds/reset/reparo, não inicie workers ou envio real de e-mails e não faça deploy. Preserve os pontos por faixa de entrega, tolerância, escala 0–100 e fórmula financeira. Não troque denominadores ou atribuição histórica sem decisão registrada na seção 11. Após a decisão, centralize a agregação aprovada e acrescente amostra/cobertura sem remover campos legados; trate `null` explicitamente na interface e nos PDFs. Preserve snapshots fechados e não faça recálculo retroativo. Valide isolamento por empresa, setor e perfil, inclusive `/reports/history`. Para qualquer migração necessária, entregue primeiro dry-run com contagens, ambiguidades, idempotência e rollback, sem execução automática. Execute os testes existentes e os novos, builds e homologação local pertinente. Ao concluir, informe arquivos alterados, exemplos antes/depois, resultados reais dos checks e hipóteses pendentes. O documento não aprova automaticamente todos os P0 nem a evolução P1–P3.

## 10. Diagnóstico do sistema atual

### 10.1 Fontes e regras confirmadas por inspeção

Os caminhos são relativos à raiz deste repositório. Funções são as referências principais; números de linha podem mudar.

| Área | Fonte / função | Comportamento atual e implicação |
|---|---|---|
| Nota de entrega | `backend/src/utils/scoring.ts`: `calculateScore` | Antes do planejado: 100; no planejado: 75; até metade do intervalo ajustado: 50; até limite com tolerância: 25; depois: 0, pelos defaults. Parâmetros configuráveis por empresa. Não há ponderação nesta função. |
| Datas e pendência | Mesmo arquivo: `getPendingStatus` | Sem entrega pode ser `PENDING`, `LATE` ou `CRITICAL`. Pendência compara instante atual e não aplica tolerância; pontuação normaliza datas à meia-noite do host e aplica tolerância. Testar fronteiras de data/fuso antes de propor alteração. |
| Média auxiliar | `backend/src/utils/helpers.ts`: `calculateAverage` | Média simples arredondada a duas casas; lista vazia retorna **0**. Trocar o helper global por `null` afeta outros consumidores, inclusive desvio médio. |
| Resumo | `backend/src/controllers/report.controller.ts`: `getSummary` | Exclui `isActive=false`; média somente de notas não nulas. `deliveryPct` mede `deliveryDate != null / processos ativos`, sem modelo de exigibilidade. Não equivale automaticamente à cobertura proposta. |
| Ranking | Mesmo controller: `getSectorRanking` | Usa `$avg: {$ifNull: ['$score', 0]}`. Ausência vira zero, diferente do resumo. Divergência confirmada; a escolha do denominador continua sendo decisão de negócio. |
| Fechamento manual | `backend/src/controllers/cycle.controller.ts`: `closeCycle` | Exclui inativos e usa notas não nulas na média; persiste snapshot de KPIs no ciclo. Clona documentos para o próximo mês, com novas identidades e notas zeradas para `null`. |
| Fechamento automático | `backend/src/services/CycleAutomationWorker.ts`: `closeAndOpen` | Soma `score || 0` e divide pelo total de ativos; diferente do manual. Persiste `avgDeviationDays=0` sem calcular desvios. Unificação precisa abranger o worker, não só controllers. |
| Histórico | `report.controller.ts`: `getHistory` | Lê snapshots de até **5 ciclos fechados**, não 5 meses distintos. Pode repetir mês entre setores. Filtra empresa, mas não setor/perfil no handler; a rota só exige autenticação e empresa. Revisar autorização antes de ampliar a exposição histórica. |
| Curva existente | `report.controller.ts`: `getProcessCurve`; `frontend/src/pages/ProcessCurveReport.tsx` | Curva diária de quantidades planejadas/realizadas/atrasadas/críticas por `plannedDate`. Não é série mensal/trimestral de notas. Reutilizar componentes onde adequado sem substituir sua finalidade. |
| Métricas | `backend/src/controllers/metrics.controller.ts`: `getMyMetrics`, `getTeamMetrics` | Exclui `PENDING` e inativos, usa `$avg` de score e converte média ausente em 0; `count` conta documentos do recorte e pode incluir notas nulas. Não tratá-lo como `n` válido sem ajuste. |
| Bônus trimestral | `backend/src/controllers/bonus.controller.ts`: `getBonusReport` | Seleciona por **data planejada**, apesar do comentário mencionar ciclos. Exclui pendentes, notas nulas e inativos; média simples das notas do trimestre, não média de três meses. Setor com média ≥75 habilita bônus: `(salário/4) × (nota aplicada/100)`, modos individual ou setor. Arredondamentos existentes devem ser preservados. |
| Regras e rastreabilidade | `backend/src/models/EvaluationConfig.ts`; `process.controller.ts`: entrega manual | Configuração tem versão; entrega consulta configuração ativa e grava nota/status. `Process` não tem campo dedicado para versão aplicada. Não é possível garantir reconstrução exata da regra histórica apenas pela nota. Conferir também confirmação e entrada por e-mail antes de mudar contratos. |
| Estados | `backend/src/types/index.ts`; `backend/src/models/Process.ts` | Prazo: `PENDING/ON_TIME/LATE/CRITICAL`; fluxo da entrega/e-mail: `DeliveryStatus`; cadastro: `isActive` com motivo/autor/data. São dimensões diferentes e já parcialmente separadas. |
| Interface | `frontend/src/pages/ProcessList.tsx`: `getStatusBadge`, `getDeliveryStatusBadge` | Já há texto e ícone para prazo e inatividade, além de rótulos do envio de e-mail. A hipótese de depender só da cor rosa não se confirma nessa listagem; identificar a tela relatada. |
| Responsável e auditoria | `process.controller.ts`: `updateProcess`, `setProcessActive`; `backend/src/models/AuditLog.ts` | Troca de responsável edita o documento do ciclo e grava antes/depois. Não há entidade de vigência de responsabilidade no modelo inspecionado. Auditoria não substitui automaticamente histórico temporal confiável para atribuição de nota. |
| Contratos e exportações | `frontend/src/types/index.ts`, `frontend/src/api/index.ts`, `frontend/src/pages/Reports.tsx`, `frontend/src/utils/*PdfExport.ts` | Contratos declaram médias numéricas e há fallbacks de UI para zero. Alterar só a API para `null` não resolve a exibição; incluir tipos, cards, gráficos e exportações no mesmo lote. |

### 10.2 Exemplo reproduzível e riscos

Fixture proposta: mesmo ciclo/setor, dois processos ativos; um entregue com nota 100 e outro sem entrega, com `score=null`.

- Resumo e fechamento manual: média **100**.
- Ranking e fechamento automático: média **50**.
- Cobertura de entregas sobre ativos: **50%**, sem provar que ambos eram exigíveis no instante consultado.
- Pela regra proposta de média apenas de notas válidas: nota **100**, `n=1`; cobertura exigível só pode ser afirmada depois de fixar prazo e elegibilidade.

Este exemplo foi inicialmente deduzido das funções e agora está reproduzido em `backend/src/tests/chronos.reporting.test.ts`, incluindo ambos os fechamentos e os endpoints de resumo, ranking, métricas e bônus. A divergência pode alterar ranking e snapshot mensal. Mudança na elegibilidade e exclusão de inativos pode afetar bônus; não aplicar a mesma refatoração financeira por consequência indireta.

### 10.3 Lacunas para evolução histórica

- `Cycle.month`, `Process.plannedDate` e `deliveryDate` representam eixos diferentes. Relatórios atuais misturam ciclo e data planejada; escolher explicitamente a competência de cada indicador e testar datas fora do mês do ciclo.
- O `_id` do processo muda na clonagem. O índice único atual é empresa/ciclo/setor/código; código pode ser editado e não é identidade histórica permanente. Carteira equivalente exige linhagem estável e tratamento de renomeações, reutilizações e transferências entre setores.
- Não foram encontrados no modelo `Process` campos dedicados de não aplicabilidade, ativação com vigência, exigibilidade por período ou dependências. `createdAt` não prova data de implantação.
- Inativos são excluídos de diversos relatórios. Isso não apaga o documento, mas não garante preservação de seus números nos recálculos. Definir quando a desativação afeta competência atual, futura ou nota já entregue.
- Snapshot antigo contém média e total, mas não `n` de notas válidas/cobertura. Não inferir amostra do total nem reescrever ciclos fechados silenciosamente.

## 11. Decisões antes de alterar comportamento

| Decisão | Proposta para homologação | Consequência |
|---|---|---|
| D1 — Denominador da nota | **Aprovada pelo usuário em 29/10/2026:** média só de notas válidas, incluindo zero | Implementada em resumo, ranking, métricas, curva e fechamentos manual/automático; bônus preservado. |
| D2 — Exigibilidade e prazo | **Aprovada a proporção de entregas sobre todos os ativos**; cobertura local acrescentada conforme seção 14 | `deliveryRatePct` continua separado. Cobertura conta ativos/aplicáveis e usa data limite para pendência/vencimento. Denominadores vazios retornam `null`; convenção sujeita à homologação humana. |
| D3 — Competência | Adotado ciclo mensal para série e trimestre de desempenho | Implementado sem mudar bônus por data planejada nem realocar documentos históricos. |
| D4 — Transferência | Adotado responsável registrado na entrega para novas avaliações | Legado sem prova temporal usa responsável do documento com alerta. Não há reatribuição retroativa automática. |
| D5 — Inatividade e não aplicável | Aplicabilidade por competência com motivo e regra da seção 14 | Situação cadastral separada; notas existentes exigem reversão antes de não aplicável. Snapshots preservados. |
| D6 — Escala e amostra | Mantidos 0–100 e alerta `n=1`; origem exata do relato 175 ainda não comprovada | Nenhuma ampliação da escala; limiar de baixa amostra acima de 1 continua sujeito a acordo. |

D1 e a razão simples de D2 foram aprovadas explicitamente pelo usuário: “Sim, aplicar essa regra localmente”. Na continuação solicitada, foram adotadas localmente as convenções explícitas da seção 14 para competência, cobertura e responsabilidade, sujeitas à homologação do produto. Isso não amplia a escala, não muda bônus e não inclui produção nem recálculo retroativo.

## 12. Ordem de implementação local

### Lote 0 — Caracterização e segurança do recorte (primeiro)

1. Preservar diff atual: já existem mudanças em lockfiles, nginx, `PdfReportPreview.tsx` e `Sidebar.tsx`, além de diretórios não rastreados. Não limpar, sobrescrever ou incluir esses arquivos por arrasto.
2. Criar fixtures sintéticas isoladas usando a infraestrutura existente de Jest/Supertest/MongoMemoryServer em `backend/src/tests`. Não importar `server.ts` nem iniciar workers de e-mail/automação no teste.
3. Reproduzir o exemplo 100/null, nota zero verdadeira, nenhum avaliado, processo inativo, dois setores no mesmo mês e dois meses com quantidades diferentes. Registrar saídas atuais por endpoint/fechamento.
4. Criar teste de acesso de `/reports/history` para Master, gestor e operador, empresas distintas e setor não autorizado. Ajustar o handler para usar o escopo existente (`getCompanySectorScope`) conforme política já aplicada aos demais indicadores, preservando a visão setorial autorizada.
5. Entregar evidências de caracterização e decisões D1–D6 para os lotes dependentes. Nenhuma migração necessária neste lote.

### Lote 1 — Consistência P0 após D1/D2

- Extrair agregação comum de desempenho com soma, quantidade de notas válidas e média, tratando zero como nota válida e ausência como ausência. Não alterar globalmente `calculateAverage` sem mapear todos os usos.
- Aplicar fórmula homologada em resumo, ranking, métricas e ambos os fechamentos; manter desvio médio em contrato próprio. Testar paridade manual/automático com as mesmas fixtures.
- Evoluir API de forma aditiva com indicadores explícitos, por exemplo `validScoreCount`, `performanceAverage`, `deliveredCount`, `eligibleCount` e `coveragePct`. Os nomes finais devem ser fixados antes do código. Preservar campo legado durante transição e documentar depreciação; os novos consumidores devem usar o campo que aceita `null`.
- Acrescentar estado derivado de avaliação na resposta sem substituir `ProcessStatus` ou `DeliveryStatus`. Entrega com nota zero continua avaliada, independentemente do envio de e-mail; combinações inconsistentes de entrega/nota devem ser sinalizadas, não corrigidas automaticamente.
- Mostrar `sem dados`, `n` e legenda na UI/PDF; garantir que `|| 0` não esconda ausência. Não usar interpolação de lacunas na futura série.
- Persistir novos metadados apenas em fechamentos futuros com versão da agregação; snapshots legados permanecem identificados como legados. Backfill, se necessário, é entrega separada, nunca parte implícita do deploy.
- Bônus recebe testes de regressão da fórmula existente. Qualquer mudança de filtro, média ou atribuição financeira deve ser decisão e lote separados.

### Lote 2 — Histórico e contexto P1

- Corrigir histórico para agrupar meses distintos no escopo autorizado, expor setor e amostra disponível e diferenciar aberto/parcial de fechado. Não fazer média simples das médias setoriais: usar soma e `n` quando disponíveis; marcar metadados legados indisponíveis.
- Implementar evolução mensal/trimestral por colaborador, setor e processo respeitando D3/D4. Trimestre de desempenho deve agregar soma de notas/`n`, se homologado; não reutilizar o valor financeiro como indicador histórico.
- Acrescentar volume de processos e marcos com origem/qualidade explícitas. Auditoria pode alimentar eventos quando há evidência, sem inventar implantação anterior.
- Volume e desempenho usam os mesmos filtros. Não inventar filtro de categoria antes de identificar ou modelar essa dimensão no sistema.

### Lote 3 — Linhagem, carteira equivalente e dependências

- Planejar identificador estável de linhagem e propagação em **todas** as rotas de clonagem (manual, automática e demais aberturas). Para legado, dry-run por empresa/setor/código/ciclo com ambiguidades explícitas; não unir códigos iguais automaticamente.
- Só depois implementar carteira comum e vigência de responsabilidade/eventos. Dependências continuam P3, fora da primeira implementação.
- Alterações de esquema Mongoose devem ser aditivas; criar índices avaliando dados existentes. Migração futura precisa de backup local verificável, execução idempotente, relatório de afetados e rollback que preserve notas e snapshots originais.

## 13. Verificação e limites desta revisão

- Lote 1, 29/10/2026: regra aprovada centralizada em `backend/src/utils/performance.ts`. Resumo, ranking, métricas e curva diária expõem `performanceAverage` (`null` sem notas), `validScoreCount`, `scoreSum`, `activeProcessCount`, `deliveredCount`, `deliveryRatePct` e `aggregationVersion=1`. Zero é nota válida. Campos numéricos legados `avgScore`/`averageScore` continuam presentes; nas métricas, `averageScore` mantém arredondamento inteiro e `count` mantém contagem legada de status não pendentes. Novos consumidores usam os campos explícitos, sem converter ausência em zero.
- Fechamentos futuros gravam esses metadados na estrutura existente de KPIs, com campos opcionais e sem defaults em snapshots antigos. Fechamento automático passou a usar a mesma média, arredondamentos e cálculo de desvio médio do manual. Não foi executada migração, backfill ou fechamento na base importada.
- Dashboard, Relatórios, Curva e PDFs exibem amostra e razão de entregas; média sem notas aparece como “Sem dados” e `n=1` recebe “Amostra reduzida”. Ciclos fechados novos são consolidados por soma de notas/quantidade válida. Consolidação com snapshots legados mostra “Sem dados comparáveis”; consulta por setor preserva a pontuação registrada e informa amostra indisponível, sem inventar denominadores.
- Testes do lote 1 abrangem 100/ausência, zero/ausência, nenhum avaliado, inativos, arredondamento de 100+75+0 (`n=3`, soma 175, média 58,33), ciclo vazio, pendentes no denominador de entregas, ordenação de setor sem dados, persistência de `null` no histórico novo e preservação de snapshots legados. Bônus continua com sua regra original e teste de regressão trimestral.
- Checagem de tipos do frontend (`npx tsc --noEmit`) e builds backend/frontend aprovados. Execução final da suíte geral: **5 suítes / 58 testes aprovados**, incluindo 21 testes de relatórios. Build frontend mantém aviso preexistente de chunks acima de 500 kB.
- QA de navegador via Playwright: **7 cenários aprovados**, sem erros de execução, com APIs sintéticas e nenhum backend de produção. Inclui relatórios em 1440px e 390px com nota zero/sem dados, curva, consolidação por amostra e mistura com legado. PDFs operacionais foram gerados, tiveram texto conferido e primeira página renderizada/inspecionada. Evidências e script reproduzível: `qa-results/reporting-v1-20261029/`. Isso não substitui homologação autenticada com os usuários reais.
- Verificação somente de leitura da base local: SHA256 de documentos das **12 coleções coincide com a importação**. Os 24 ciclos com mistura de notas mantêm seus registros originais; exemplo com 45 ativos e 34 notas: soma 2725, média aprovada 80,15, proporção de entregas 34/45 = 75,56%; a fórmula antiga do ranking retornava 60,56. Resultado em `qa-results/reporting-v1-20261029/local-readonly-validation.json`, sem identificação de pessoas/empresas.
- Lote 0, 29/10/2026: corrigido `getHistory` em `backend/src/controllers/report.controller.ts` para aplicar `getCompanySectorScope` antes do limite de cinco ciclos; filtro opcional `sector` validado, setor não autorizado retorna 403, usuário sem setores recebe lista vazia. Mantidos snapshots e formato da resposta. Nenhuma consolidação mensal nova ou alteração de média neste lote.
- Regressão comprovada: seis testes de acesso falharam com a implementação anterior e passaram após a correção. Suíte geral após a correção: **5 suítes / 49 testes aprovados**. Depois foram acrescentados cinco casos de ordenação/limite/validação; a execução final específica de `chronos.reporting.test.ts` passou com **17/17 testes**. Os 37 testes preexistentes passaram na execução geral.
- Builds backend (`tsc`) e frontend (`vite build`) aprovados. Frontend emitiu aviso de chunks grandes; não é falha de build e não foi tratado neste lote de backend. Não houve homologação visual nesta etapa.
- Consulta somente de leitura na cópia local importada encontrou **24 ciclos com processos ativos e mistura de notas presentes e ausentes** (ciclos não necessariamente abertos). Exemplo sem identificação: 45 processos ativos, 34 notas válidas; média de notas 80,15 e média contando ausências como zero 60,56. Os números demonstram impacto, não aprovam mudança de fórmula.
- Arquivos de aplicação alterados neste lote: somente o controller de relatórios e o novo arquivo de testes. A base de homologação foi apenas consultada; testes de escrita/fechamento usaram MongoMemoryServer isolado, com envio de e-mail simulado. Nenhum deploy, migração, recálculo de snapshot ou alteração de bônus.
- Baseline executada em 29/10/2026: `npm test -- --runInBand` no backend — **4 suítes e 37 testes passaram**, em 72,353 s. Os testes de e-mail incluem falha SMTP controlada; esses logs não representam falha da suíte. Esta baseline não cobre ainda as novas divergências de agregação descritas acima. Builds não executados nesta revisão documental.
- Foram inspecionados fontes, modelos, rotas, contratos, componentes e configuração dos testes. Banco operacional, telas em execução e produção não foram consultados.
- A suíte existente usa MongoMemoryServer e limpa somente suas coleções temporárias. O comando geral é `npm test -- --runInBand` em `backend`; não assumir que `test:unit`/`test:integration` selecionam os testes atuais, pois os nomes existentes não seguem essas pastas.
- Após implementação: executar suíte backend, build backend (`npm run build`), build frontend (`npm run build`) e conferir cards, filtros e PDFs localmente. Build do Vite sozinho não demonstra checagem completa de tipos nem homologação visual.
- A seção 7 permanece como aceite de produto; transferência temporal, não aplicável, 175 e carteira equivalente são cenários futuros condicionados às decisões/modelagem, não defeitos já reproduzidos.

## 14. Continuação — estados, evolução, marcos e carteira

### Regras locais adotadas e limites

- **Competência:** `Cycle.month`, tanto na série mensal quanto na trimestral. Bônus mantém sua seleção e fórmula anteriores por data planejada. O trimestre usa soma de notas válidas / quantidade válida, não média das médias dos meses.
- **Prazo da avaliação:** fim do dia da `limitDate`, usando o calendário operacional de Cuiabá. Essa classificação não altera a tolerância nem o cálculo da nota de entrega. O prazo pode, portanto, ter dimensão diferente da pontuação configurada.
- **Exigível:** documento ativo e aplicável na competência. A cobertura inclui avaliados, pendentes ainda no prazo e ausências vencidas no denominador; o numerador conta notas válidas nesses documentos. Inativos e não aplicáveis ficam de fora; denominador vazio retorna `null`.
- **Não aplicável:** decisão de gestor/Master com motivo obrigatório, exclusivamente em ciclo aberto e sem nota/entrega já registrada. Não equivale a inativação. Ao clonar para a competência seguinte, a aplicabilidade volta a ser exigível, preservando o motivo na competência anterior.
- **Responsabilidade:** novas entregas guardam o responsável e a versão de regras utilizados. Transferência posterior não reatribui a nota na nova análise histórica. Reversão limpa essa atribuição para uma eventual nova entrega. No legado sem registro, usa-se o responsável do documento com aviso explícito de limitação, sem inventar vigências.
- **Identidade entre competências:** novos registros recebem linhagem e clonagens manual/automática preservam a origem. Mesmo código/título no legado não prova identidade. Master pode revisar uma prévia e confirmar o vínculo, com motivo, conflitos por competência e auditoria. Falhas parciais de gravação têm compensação testada. Não há associação automática ou backfill executado.
- **Volumes trimestrais:** ativos/exigíveis/entregues contam ocorrências por competência; a carteira comum conta identidades distintas. Essa diferença aparece na interface. Lacunas de meses permanecem sem dados.
- **Eventos:** implantações e marcos manuais registram autor/data/descrição; inclusões, transferências, ativação/desativação e aplicabilidade vêm de auditoria comprovada. Alterações de parâmetros vêm de configurações versionadas. Importação/`createdAt` não são tratados como implantação comprovada. Eventos usam data de Cuiabá e não a virada do mês UTC.

### Entregas técnicas

- `backend/src/utils/assessment.ts`: classificação comum a filtro, exibição e cobertura, incluindo sinalização de combinações inconsistentes de nota/entrega.
- `backend/src/controllers/evolution.controller.ts`: `GET /api/reports/performance-history` e `POST /api/reports/milestones`; intervalo máximo de 60 meses, até 10 mil documentos por recorte, isolamento de empresa/setor, filtros de colaborador/processo/categoria e competências mensais/trimestrais.
- A série é reconstruída dos documentos por ciclo, com indicação de período parcial, número de notas/meses observados e lacunas. Não substitui nem regrava snapshots antigos.
- Comparação de períodos oferece carteira total/equivalente, tamanho comum, exclusões por motivo, amostra de cada lado e delta em pontos da escala 0–100. Sem carteira comum comprovada, retorna sem dados em vez de associar processos por código.
- A lista de eventos tem limites declarados; se truncada, contagens de inclusões/transferências são marcadas como limitadas em vez de aparentarem totais completos.
- `backend/src/controllers/processAssessment.controller.ts`: aplicabilidade e vínculo revisado entre competências, com controles de perfil, ciclo, empresa, motivo, colisões, quantidade esperada e idempotência.
- Campos aditivos opcionais em `Process` e KPIs de `Cycle`; coleção nova de marcos. Nenhum dado existente foi regravado para preencher esses campos. Categoria é texto opcional por processo, sem inventar taxonomia para registros antigos.
- Interface: Processos mostra estado de avaliação separado de prazo/e-mail e oferece filtros de avaliação/atividade; gestores têm ação de aplicabilidade com motivo. Relatórios oferece filtro de avaliação consistente entre resumo/extrato/PDF.
- Em **Relatórios → Evolução mensal/trimestral, carteira e marcos**: filtros, gráfico conjunto sem interpolação de lacunas, tabela de amostra/cobertura, comparação, exclusões, filtro da linha do tempo, formulário de marcos e vínculo histórico revisado. Não foi alterado o menu lateral do usuário.
- PDF de evolução com série, comparação, exclusões, eventos e avisos do legado. PDFs operacionais e de curva também exibem cobertura e estado da avaliação.

### Validação e o que ainda depende de pessoas

- Suíte backend completa: **6 suítes / 81 testes aprovados**, incluindo 23 novos testes desta continuação. Cobrem prazo de Cuiabá, cobertura, não aplicável, nota zero, filtros, lacunas, trimestre, carteira, permissões, transferência, vínculo/dry-run/rollback, marcos, clonagem e data de evento na virada UTC.
- Builds backend/frontend e checagem de tipos frontend aprovados; Vite mantém aviso de bundle grande, sem falha.
- QA sintética de navegador: **8 cenários novos aprovados**, mais **7 cenários anteriores de regressão**. Gráfico/controles inspecionados em desktop e 390px; duas páginas do PDF de evolução renderizadas e conferidas. Escritas de QA ocorreram somente no MongoMemoryServer ou em APIs sintéticas.
- Nova API consultada, sem servidor/workers, nas cinco empresas e 2.148 processos da base importada, com `autoCreate` e `autoIndex` desativados. SHA256 de documentos das 12 coleções originais continua igual à importação. Resultado anônimo em `qa-results/evolution-20261029/local-readonly-validation.json`.
- **Ainda necessário:** homologação funcional pelo responsável com exemplos reais; confirmar as convenções locais acima; revisar os vínculos que se deseja comparar no legado e cadastrar marcos de implantação quando houver evidência. A ferramenta para esses registros está implementada, mas esses fatos não podem ser preenchidos automaticamente com segurança.
- **Fora desta execução:** dependências entre processos, publicação na VPS e qualquer recálculo/migração retroativa. A origem exata do relato de nota 175 continua não comprovada; soma 175 de várias notas não significa nota individual acima de 100.

---

**Nota de produto:** O objetivo é avaliar desempenho com contexto de carga operacional e qualidade da amostra, sem afirmar que aumento de processos causa melhora de desempenho.
