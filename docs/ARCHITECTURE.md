# Arquitetura do Projeto

## Visão Geral

O Coleciona Cards é construído sobre uma arquitetura de microsserviços moderada, organizada em um monorepo para facilitar o compartilhamento de tipos e a coordenação entre as equipes de Frontend e Backend.

## 🧱 Componentes do Sistema

### 1. Backend (NestJS)
Localizado em `apps/api`, o backend é o "cérebro" da aplicação.
- **Autenticação**: Baseada em JWT com tokens de acesso (curta duração) e atualização (longa duração).
- **Módulos Principais**:
  - `AuctionModule`: Gerencia o ciclo de vida dos leilões, lances e vencedores.
  - `CollectionModule`: Controla o inventário do usuário, pastas, lojas e sistema de propostas/carrinho.
  - `OrderModule`: Gerencia pedidos gerados a partir de propostas aceitas ou leilões finalizados.
  - `UserModule`: Gerencia perfis, slugs públicos e configurações de conta.
  - `RecognitionModule`: Processa metadados de cartas através de IA (OpenAI/Gemini) para reconhecimento inteligente.

### 2. Frontend (React)
Localizado em `apps/web`, é uma Single Page Application (SPA).
- **Gerenciamento de Estado**: Utiliza Hooks do React e Context API para temas e tours.
- **UI/UX**: Baseado em TailwindCSS com foco em performance e responsividade.
- **Onboarding**: Sistema de tour guiado integrado em todas as telas críticas via `AppTour`.

### 3. Pricing Service (Node.js)
Localizado em `apps/pricing-service`, é um serviço utilitário para scraping.
- **Motivação**: Separado da API principal para isolar dependências pesadas (Puppeteer) e permitir execução em infraestruturas específicas (ex: rodar localmente para evitar bloqueios de IP).
- **Cache**: Armazena preços no esquema `pricing` do banco de dados para consultas rápidas pela API.

### 4. Shared Package
Localizado em `packages/shared`, contém:
- Interfaces de DTOs compartilhadas.
- Enums e constantes globais.
- Funções de formatação e utilitários comuns.

## 🌍 Fluxo de Dados

1. O **Frontend** solicita dados da **API**.
2. A **API** consulta o **PostgreSQL** (esquema `public`).
3. Se necessário (ex: consulta de preço BR), a **API** chama o **Pricing Service**.
4. O **Pricing Service** verifica o cache (esquema `pricing`) ou realiza o scraping em tempo real.
5. Os dados retornam para a **API**, que os processa e entrega ao **Frontend**.

## 🚀 Infraestrutura e Deployment

- **Database**: PostgreSQL (Multi-schema).
- **File Storage**: Local (dev) ou Supabase Storage (prod) para banners e logos.
- **Email**: Resend API para comunicações transacionais.
- **Deploy**: Vercel (Frontend) e Render (Backend/DB).
