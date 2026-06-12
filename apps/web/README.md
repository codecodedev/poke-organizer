# Coleciona Cards Web

Frontend da plataforma Coleciona Cards, desenvolvido com React e Vite.

## 🛠️ Tecnologias
- **React**: Biblioteca para interfaces de usuário.
- **Vite**: Build tool extremamente rápida.
- **TailwindCSS**: Framework CSS utilitário para estilização rápida e responsiva.
- **Lucide React**: Biblioteca de ícones.
- **React Joyride**: Tours guiados e onboarding.
- **Framer Motion**: Animações fluidas.

## 🚦 Começando

### Instalação
```bash
pnpm install
```

### Configuração
Crie um arquivo `.env` na raiz (ou use o do monorepo) com a variável:
```bash
VITE_API_URL=http://localhost:3333
```

### Rodando a aplicação
```bash
pnpm dev
```

## 🎨 Padrões visuais
- **Componentes de UI**: Localizados em `src/components/ui`. Use-os para manter a consistência de botões, modais e painéis.
- **Dark Mode**: O sistema é *dark-first*. Utilize as classes `dark:` do Tailwind para garantir compatibilidade.
- **Tours**: Sempre que adicionar uma feature complexa, considere adicionar passos no `src/components/collections/CollectionsTour.tsx`.

## 📦 Build e Deploy
```bash
pnpm build
```
O output gerado em `dist/` pode ser servido em qualquer host estático (Vercel, Netlify, Cloudflare Pages).
