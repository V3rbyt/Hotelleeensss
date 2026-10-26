# Plano Noturno — Hotelleensss

**Stack detectado:** Node.js (ESM) + Express 5 + SQLite (better-sqlite3) + vanilla ES modules frontend
**Estado:** Working tree com 27 arquivos modificados (logos, renomeação marca, correções segurança/XSS, rotas faltantes)

---

## Backlog Priorizado

### P1 — Estabilidade / Correção do que já existe

| # | Item | Ação | Critério de pronto |
|---|------|------|-------------------|
| 1 | Rodar testes existentes | `npm test` | Todos passam (ou falhas conhecidas documentadas) |
| 2 | Verificar lint/typecheck | Procurar scripts em package.json | `npm run lint` / `npm run typecheck` se existirem |
| 3 | Validar start do servidor | `npm start` (ou `node server/index.js`) | Sobe sem erros, `/api/health` responde 200 |
| 4 | Checar `.env` vs `.env.example` | Comparar e documentar faltantes | README/docs atualizado |
| 5 | Validar schema.sql + seed.js | `npm run seed:demo` depois de init DB | Dados de demo criam usuários/hotéis/guias/agências |
| 6 | Corrigir testes que quebraram por renomeação | Ajustar asserts que esperam "LocaLens" | Testes passam |

### P2 — Continuidade natural

| # | Item | Ação | Critério de pronto |
|---|------|------|-------------------|
| 7 | Adicionar constraint NOT NULL CPF em `guide_profiles` via migração ou seed | Verificar se schema precisa | Guia não pode ser criado sem CPF no banco |
| 8 | Validar URLs salvas no backend (impedir `javascript:`) | Middleware ou validador em `catalog.js` | XSS via website/logoUrl mitigado no servidor |
| 9 | Escapar wildcards `[` `]` `^` no helper `like()` | `catalog.js` linha ~100 | Busca com colchetes não quebra |
| 10 | Documentar variáveis de ambiente no README | Seção "Configuração" | `.env.example` coberto |

### P3 — Backlog pequeno (TODOs / gaps óbvios)

| # | Item | Ação | Critério de pronto |
|---|------|------|-------------------|
| 11 | `.gitignore` completo | Verificar node_modules, .env, dist, logs | Commit se faltar algo |
| 12 | Health check inclui versão/app name | `server/app.js` linha 47 | Retorna `{ ok: true, name: "Hotel Lens", version: "1.0.0" }` |
| 13 | README.md atualizado com nova marca | Substituir "LocaLens" por "Hotel Lens" | README coerente |

---

## Riscos identificados

- Testes podem falhar por strings "LocaLens" hardcoded em asserts
- Seed pode criar dados com marca antiga
- Schema não tem NOT NULL no CPF do guia (apenas validação na aplicação)
- Nenhum script de lint/typecheck declarado no package.json

---

## Ordem de execução

1. `npm test` → corrigir falhas
2. `npm start` (background) → `curl /api/health` → matar
3. `npm run seed:demo` → verificar console
4. Comparar `.env.example` com variáveis usadas no código
5. Ajustes P2/P3 se tempo
6. Commits atômicos por grupo lógico
7. Atualizar SESSION_REPORT.md