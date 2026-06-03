# Poke Organizer

Monorepo para gerenciar colecoes de cartas Pokemon com React, NestJS, Prisma, Postgres e Docker.

## Rodando com Docker

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:5173
- API: http://localhost:3333
- OpenAPI: http://localhost:3333/docs

## Comandos uteis

```bash
docker compose exec api pnpm prisma migrate dev
docker compose exec api pnpm test
docker compose exec web pnpm test
docker compose down
```

No ambiente atual do Codex, Docker e pnpm podem nao estar instalados no PATH. O projeto esta preparado para rodar quando Docker Desktop ou Colima estiver disponivel.

## Deploy

Estrategia recomendada:

- Frontend: Vercel, app Vite estatico em `apps/web`.
- API: Render Web Service usando `apps/api/Dockerfile`.
- Banco: Render Postgres compartilhado pela API e pelo pricing-service local.
- Pricing-service: roda localmente apontando para o banco de producao no schema `pricing`.

### API no Render

O arquivo `render.yaml` cria:

- `poke-organizer-api`
- `poke-organizer-db`

Configure estes secrets/envs no Render:

```bash
WEB_ORIGIN=https://SEU_FRONT.vercel.app
POKEMON_TCG_API_KEY=
```

`JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` podem ser gerados pelo Render via blueprint.

O container da API executa `prisma migrate deploy` antes de iniciar `node dist/main.js`.

### Web na Vercel

Configure o projeto com root directory `apps/web`.

Env de producao:

```bash
VITE_API_URL=https://SUA_API.onrender.com
```

O `apps/web/vercel.json` define install/build/output para o monorepo.

### Pricing-service local com banco de producao

Crie `apps/pricing-service/.env.local` apontando para a URL externa do banco:

```bash
PRICING_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=pricing&sslmode=require
PRICING_SERVICE_PORT=3344
PRICING_SERVICE_HOST=127.0.0.1
LIGA_SYNC_HEADLESS=false
```

Depois rode:

```bash
pnpm dev:pricing:local
```

O schema `pricing` e as tabelas usadas pelo pricing-service sao criados pela migration da API.
O pricing-service local nao roda `db push`; ele apenas gera client, compila e grava precos nas tabelas ja migradas.
