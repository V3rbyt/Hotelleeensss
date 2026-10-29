# Plano Noturno — Hotelleensss

**Stack detectado:** Node.js (ESM) + Express 5 + SQLite (better-sqlite3) + vanilla ES modules frontend

---

## Backlog Priorizado

### P1 — Estabilidade / Marca (OK)
| # | Item | Ação | Status |
|---|------|------|--------|
| 1 | Restaurar CSS original | Restaurado e mesclado | Concluído |
| 2 | Página 404 personalizada | Criada e integrada | Concluído |
| 3 | Padronização marca | "Hotel Lens" em todo lugar | Concluído |
| 4 | Migração localStorage | `hotellens_theme` | Concluído |

### P2 — Segurança e LGPD (OK)
| # | Item | Ação | Status |
|---|------|------|--------|
| 5 | Anti-XSS em URLs | `sanitizeUrl` aplicado | Concluído |
| 6 | LIKE sanitizado | Escapa `% _ [ ] ^` | Concluído |
| 7 | LGPD Session Drop | Deletar sessões no delete | Concluído |
| 8 | Bloqueio conta pendente | Middleware bloqueia | Concluído |
| 9 | Senhas fortes | Blocklist comum | Concluído |

### P3 — Limpeza e DevOps (OK)
| # | Item | Ação | Status |
|---|------|------|--------|
| 10 | Limpeza periódica DB | setInterval background | Concluído |
| 11 | Seed real | Belo Horizonte coords | Concluído |
| 12 | IA Context Protection | Truncate/Limit 30 | Concluído |
| 13 | Higiene repo | .gitignore + .env fix | Concluído |

---
🤖 Plano executado com sucesso e testes validados.
