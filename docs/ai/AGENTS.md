# Poke Organizer Agent Guide

## Project Shape

This repository is a pnpm monorepo:

- `apps/api`: NestJS API using Fastify, Prisma and Postgres.
- `apps/web`: React/Vite frontend.
- `packages/shared`: shared TypeScript types and normalization helpers.

Use Docker for local development:

```bash
cp .env.example .env
docker compose up --build
```

## Architecture Decisions

- Keep external card providers behind services. The app should work even if a provider is down.
- `CatalogService` owns Pokemon TCG API and TCGdex lookup/caching.
- `PricingService` owns price estimates. Brazilian sources must remain plug-in providers with cache and feature flags.
- `RecognitionService` receives OCR text and returns ranked card candidates. The browser does camera capture and OCR.
- Auth starts with email/password, but `UserIdentity` exists so Google/GitHub login can be added without changing user ownership.

## Data Rules

- Never store camera frames by default.
- A collection item always belongs to one user.
- Prices shown from converted international sources must be marked as fallback estimates.
- Manual BRL price on a collection item has priority over provider estimates in the UI.

## Provider Notes

Pokemon TCG API is the primary catalog source for English cards and images.
TCGdex is the secondary catalog source for broader language coverage.
LigaPokemon and MYP Cards should not be required for the MVP to run. If investigated later, add them inside `BrazilianMarketProvider` with conservative rate limiting, caching and feature flags. Do not add code that depends on bypassing Cloudflare, CAPTCHAs or fragile login automation.

## Quality Bar

Before opening a PR, run:

```bash
docker compose up --build
docker compose exec api pnpm typecheck
docker compose exec api pnpm test
docker compose exec web pnpm typecheck
docker compose exec web pnpm test
```
