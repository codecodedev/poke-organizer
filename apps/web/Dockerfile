FROM node:22-alpine

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --filter web... --frozen-lockfile=false

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "pnpm install --frozen-lockfile=false && pnpm --filter web dev"]
