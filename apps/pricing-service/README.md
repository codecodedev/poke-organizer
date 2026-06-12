# Coleciona Cards Pricing Service

Microserviço especializado em web scraping de preços de cartas Pokémon.

## 🛠️ Tecnologias
- **Node.js**: Runtime.
- **Playwright**: Automação de navegador para scraping.
- **Prisma**: Acesso ao banco de dados (schema `pricing`).
- **Fastify**: Servidor web minimalista.

## 🚀 Funcionalidades
- Sincronização de preços com a **LigaPokemon**.
- Sincronização de preços com o **MyPCards**.
- Cache local de edições e cartas para otimização de buscas.

## 🚦 Rodando Localmente

### Configuração
Crie um arquivo `.env` com a `PRICING_DATABASE_URL` apontando para o banco da aplicação.
```bash
PRICING_DATABASE_URL=postgresql://user:pass@host:port/db?schema=pricing
```

### Comandos
```bash
pnpm install
pnpm dev
```

## 🧠 Como funciona
O serviço expõe endpoints para a API principal consultar preços. Quando um preço não está em cache ou está expirado, o serviço inicia uma instância do Playwright (ou usa uma existente via CDP) para buscar o valor real nos marketplaces brasileiros.
