# Architecture

## Runtime

The local runtime has three Docker services:

- `postgres`: Postgres 16 for development.
- `api`: NestJS/Fastify API on port `3333`.
- `web`: Vite dev server on port `5173`.

Production can keep the same boundaries: Vercel for `apps/web`, Render/Railway for `apps/api`, and a managed Postgres database.

## Backend Modules

- `AuthModule`: email/password authentication, JWT access token, refresh token persistence and future social identity table.
- `CardsModule`: catalog search, remote provider calls, card cache.
- `CollectionModule`: user-owned collection CRUD.
- `RecognitionModule`: converts OCR text into ranked card candidates.
- `PricingModule`: manual/national/fallback price estimates.

## Frontend Flows

1. User registers or logs in.
2. User searches by card name and optionally number.
3. User adds a card to the collection.
4. User can open the camera, run OCR locally, confirm a suggested card and add it.
5. Collection shows quantities and BRL estimates when available.

## API Contracts

The API exposes OpenAPI at `/docs`. Shared application types live in `packages/shared`; generated clients can be added later once the API stabilizes.
