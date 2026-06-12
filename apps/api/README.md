# Coleciona Cards API

Backend da plataforma Coleciona Cards, desenvolvido com NestJS e Prisma.

## 🛠️ Tecnologias
- **NestJS**: Framework Node.js para aplicações eficientes e escaláveis.
- **Fastify**: Adaptador de alta performance para o NestJS.
- **Prisma**: ORM moderno para Node.js e TypeScript.
- **PostgreSQL**: Banco de dados relacional.
- **Swagger**: Documentação interativa da API.

## 🚦 Começando

### Instalação
```bash
pnpm install
```

### Banco de Dados
Certifique-se de que o Postgres está rodando e a `DATABASE_URL` no `.env` está correta.
```bash
pnpm prisma migrate dev
```

### Rodando a aplicação
```bash
# development
pnpm start:dev

# production mode
pnpm start:prod
```

## 📖 Documentação
A documentação Swagger está disponível em `/docs` quando o servidor está rodando.

## 🏗️ Estrutura de Pastas
- `src/auth`: Autenticação e estratégias JWT.
- `src/auction`: Módulo de leilões.
- `src/collection`: Gerenciamento de pastas e itens.
- `src/order`: Pedidos originados de propostas aceitas.
- `src/pricing`: Proxy e integração com o microserviço de preços.
- `src/recognition`: Integração com AI para reconhecimento de áudio/cartas.
