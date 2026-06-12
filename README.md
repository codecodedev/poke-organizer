# Coleciona Cards (Poke Organizer)

Monorepo para gerenciamento, exibição e negociação de cartas Pokémon. Uma plataforma completa que une colecionadores, jogadores e vendedores.

## 🚀 Funcionalidades Principais

- **Inventário Inteligente**: Cadastro de cartas via busca ou reconhecimento de áudio (Powered by AI).
- **Gerenciamento de Coleções**: Organize suas cartas em pastas temáticas, decks ou lotes para venda.
- **Mercado Público**: Transforme suas pastas em lojas públicas com links exclusivos (`/p/seu-token`).
- **Sistema de Propostas**: Interessados podem enviar ofertas por cartas individuais ou lotes fechados (Modo Global).
- **Carrinho Dinâmico**: Gerenciamento de propostas em tempo real com suporte a múltiplos itens.
- **Leilões**: Crie e participe de leilões ativos da comunidade com lances em tempo real.
- **Sincronização de Preços**: Integração com LigaPokemon e MyPCards para manter sua coleção valorizada.
- **Tour Guiado Interativo**: Onboarding automático para novos usuários e suporte via botão de ajuda em todas as telas.
- **Perfis Públicos**: Mostre sua reputação, coleções e leilões ativos em um slug personalizado.

## 🛠️ Arquitetura

O projeto é um monorepo (`pnpm`) composto por:

- **`apps/api`**: Backend NestJS (Fastify) com Prisma ORM e PostgreSQL.
- **`apps/web`**: Frontend React (Vite + TailwindCSS) com UI moderna e responsiva.
- **`apps/pricing-service`**: Microserviço em Node.js especializado em web scraping e sincronização de preços brasileiros.
- **`packages/shared`**: Tipagens e utilitários compartilhados entre frontend e backend.

## 📦 Como Rodar Localmente

1. **Pré-requisitos**: Node.js 20+, Docker e pnpm.
2. **Configuração**:
   ```bash
   cp .env.example .env
   # Preencha as chaves de API necessárias (PokemonTCG, OpenAI/Gemini, Resend)
   ```
3. **Subir Infra (Database)**:
   ```bash
   docker compose up -d postgres
   ```
4. **Instalar Dependências**:
   ```bash
   pnpm install
   ```
5. **Rodar Aplicação**:
   ```bash
   pnpm dev
   ```

- **Web**: http://localhost:5173
- **API**: http://localhost:3333
- **Swagger Docs**: http://localhost:3333/docs

## 📖 Documentação Detalhada

- [Arquitetura de AI](./docs/ai/architecture.md)
- [Variáveis de Ambiente](./.env.example) (Consulte os comentários no arquivo)

## 🚢 Deploy

A aplicação está configurada para deploy automático:
- **API/Database**: Render (via `render.yaml`)
- **Web**: Vercel (via `apps/web/vercel.json`)
- **Pricing Service**: Recomendado rodar localmente ou via cron job em servidor com suporte a Chromium/Puppeteer.
