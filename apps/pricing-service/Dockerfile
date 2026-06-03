FROM node:22-alpine

WORKDIR /workspace

RUN apk add --no-cache chromium nss openssl
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/pricing-service/package.json apps/pricing-service/package.json

RUN pnpm install --filter pricing-service... --frozen-lockfile=false

COPY . .

EXPOSE 3344

CMD ["sh", "-c", "if [ ! -d apps/pricing-service/node_modules/playwright ]; then rm -rf node_modules apps/pricing-service/node_modules; fi; pnpm install --filter pricing-service... --frozen-lockfile=false && pnpm --filter pricing-service dev"]
