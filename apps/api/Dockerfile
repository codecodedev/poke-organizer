FROM node:22-alpine AS deps

WORKDIR /workspace

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --filter api... --frozen-lockfile

FROM node:22-alpine AS build

WORKDIR /workspace

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=deps /workspace/node_modules node_modules
COPY --from=deps /workspace/apps/api/node_modules apps/api/node_modules
COPY --from=deps /workspace/packages/shared/node_modules packages/shared/node_modules
COPY . .

RUN pnpm --filter api prisma generate
RUN pnpm --filter @poke-organizer/shared build
RUN pnpm --filter api build

FROM node:22-alpine AS runner

WORKDIR /workspace

ENV NODE_ENV=production

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=build /workspace/node_modules node_modules
COPY --from=build /workspace/apps/api/node_modules apps/api/node_modules
COPY --from=build /workspace/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /workspace/packages/shared/dist packages/shared/dist
COPY --from=build /workspace/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json

EXPOSE 3333

CMD ["sh", "-c", "pnpm --filter api deploy:migrate && pnpm --filter api start"]