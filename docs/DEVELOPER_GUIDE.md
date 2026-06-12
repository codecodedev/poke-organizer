# Developer Guide - Coleciona Cards

Este guia destina-se a novos desenvolvedores que estão entrando na equipe. Ele explica a arquitetura, padrões e fluxos de trabalho do projeto.

## 🏗️ Estrutura do Projeto

O projeto utiliza um monorepo gerenciado pelo `pnpm`.

- **`apps/api`**: Backend NestJS. Concentra toda a lógica de negócio, persistência e autenticação.
- **`apps/web`**: Frontend React. SPA moderna utilizando Vite, TailwindCSS e Lucide Icons.
- **`apps/pricing-service`**: Microserviço utilitário. Realiza o scraping de preços da LigaPokemon e MyPCards. Roda isolado para não sobrecarregar a API e facilitar o bypass de Cloudflare (quando necessário rodar localmente).
- **`packages/shared`**: Biblioteca de tipos e utilitários. Garante consistência de dados entre Front e Back.

## 💻 Fluxo de Desenvolvimento

### 1. Requisitos
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose (para o Postgres)

### 2. Setup Inicial
```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm --filter @poke-organizer/api prisma migrate dev
pnpm dev
```

### 3. Padrões de Código
- **Backend**:
  - NestJS com abordagem modular.
  - Prisma para ORM.
  - DTOs com `class-validator` para validação de entrada.
  - Documentação automática via Swagger.
- **Frontend**:
  - React com Functional Components e Hooks.
  - TailwindCSS para estilização (evite CSS puro, prefira classes utilitárias).
  - Lucide React para ícones.
  - Componentes de UI reaproveitáveis em `apps/web/src/components/ui`.

## 🗄️ Banco de Dados

Utilizamos dois esquemas principais no Postgres:
- `public`: Contém tabelas de usuários, coleções, itens, leilões e ordens.
- `pricing`: Cache de preços sincronizado pelo `pricing-service`.

Sempre que alterar o `schema.prisma`, execute:
```bash
pnpm --filter @poke-organizer/api prisma migrate dev
```

## 🚀 Deployment

- **CI/CD**: Configurado via GitHub Actions (opcional) ou deploys diretos da Vercel/Render.
- **Produção**:
  - API roda em um container Docker no Render.
  - Web é servido como arquivos estáticos na Vercel.
  - O banco de dados é um Postgres gerenciado (Render ou Supabase).

## 🆘 Suporte e Ajuda

- **Swagger**: Acesse `/docs` na API rodando localmente para ver todos os endpoints disponíveis.
- **Tours**: O projeto possui tours guiados (`react-joyride`) que explicam as principais funcionalidades. Verifique `apps/web/src/components/collections/CollectionsTour.tsx`.
