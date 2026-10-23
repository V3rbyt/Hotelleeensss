# LocaLens

Plataforma de turismo em HTML, CSS e JavaScript, com API Node.js (Express) e SQLite.

O repositório original neste workspace estava vazio. A identidade visual abaixo é **provisória** (veja `docs/IDENTIDADE.md`). Não há logo oficial no projeto.

## Como executar

Requisito: Node.js 22 ou superior.

```bash
npm install
copy .env.example .env
npm start
```

Abra http://localhost:3000

Dados de demonstração (opcional, claramente rotulados como amostra, **não são estabelecimentos reais**):

```bash
npm run seed:demo
```

Contas demo (senha `Demo1234`):

- `demo.guia@localens.invalid`
- `demo.agencia@localens.invalid`
- `demo.hotel@localens.invalid`

## Variáveis de ambiente

| Variável | Função |
| --- | --- |
| `PORT` | Porta HTTP (padrão 3000) |
| `SESSION_SECRET` | Segredo das sessões (altere em produção) |
| `GROQ_API_KEY` | Chave da API Groq (somente no servidor) |
| `GROQ_MODEL` | Modelo Groq (padrão `openai/gpt-oss-20b`) |
| `APP_URL` | URL pública |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envio de e-mail para verificação e recuperação |

Sem `GROQ_API_KEY`, o assistente responde com erro claro (código implementado). O envio de e-mail usa nodemailer (`server/utils/mailer.js`): com `SMTP_HOST/USER/PASS` configurados, verificação e recuperação são enviadas de verdade; sem SMTP, os tokens são devolvidos na resposta da API apenas para desenvolvimento local.

## Avaliações e eventos

- `POST /api/reviews` (login + CSRF): cria ou atualiza a avaliação do usuário sobre hotel/guia/agência (nota 1–5). `GET /api/reviews?target_type=&target_id=` lista avaliações; `DELETE /api/reviews/:id` remove a própria.
- Eventos do hoteleiro: `GET/POST /api/me/hotel/events` e `PUT/DELETE /api/me/hotel/events/:id`, com formulário de cadastro/edição no painel Configurações → Hotel.
- Verificação de e-mail: página `public/verificar.html` aceita `?token=` do link do e-mail ou código colado manualmente.

## Banco de dados

SQLite em `data/localens.db` (Node.js `node:sqlite`). Consultas parametrizadas. CPF/CNPJ são gravados só como hash, nunca no perfil público.

PostgreSQL/Supabase não estavam configurados no ambiente; o esquema está em `server/schema.sql` e pode ser migrado depois.

## Mapas

Leaflet + tiles OpenStreetMap. Geocodificação via Nominatim, proxied em `GET /api/map/geocode` (User-Agent, cache e limite de 1 req/s).

## Assistente

`POST /api/ai/chat` no backend. A chave Groq nunca vai ao frontend. O modelo só recebe um recorte do catálogo cadastrado e não deve inventar hotéis, preços ou documentos.

## Testes

```bash
npm test
```
