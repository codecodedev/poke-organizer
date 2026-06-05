CREATE TYPE "DeckFormat" AS ENUM ('STANDARD', 'CASUAL');
CREATE TYPE "DeckGenerationMode" AS ENUM ('OWNED_ONLY', 'ALLOW_MISSING');
CREATE TYPE "DeckCardSource" AS ENUM ('OWNED', 'MISSING');

ALTER TABLE "Card"
  ADD COLUMN "supertype" TEXT,
  ADD COLUMN "subtypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "abilities" JSONB,
  ADD COLUMN "attacks" JSONB,
  ADD COLUMN "retreatCost" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "convertedRetreatCost" INTEGER;

CREATE TABLE "Deck" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "format" "DeckFormat" NOT NULL DEFAULT 'STANDARD',
  "generationMode" "DeckGenerationMode" NOT NULL DEFAULT 'OWNED_ONLY',
  "archetypeId" TEXT,
  "validationStatus" TEXT NOT NULL DEFAULT 'unchecked',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeckCard" (
  "id" TEXT NOT NULL,
  "deckId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "source" "DeckCardSource" NOT NULL DEFAULT 'OWNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeckValidationResult" (
  "id" TEXT NOT NULL,
  "deckId" TEXT NOT NULL,
  "isValid" BOOLEAN NOT NULL,
  "totalCards" INTEGER NOT NULL,
  "issues" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeckValidationResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeckArchetype" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "format" "DeckFormat" NOT NULL DEFAULT 'STANDARD',
  "strategy" TEXT,
  "source" TEXT NOT NULL DEFAULT 'curated',
  "sourceUrl" TEXT,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeckArchetype_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeckArchetypeCard" (
  "id" TEXT NOT NULL,
  "archetypeId" TEXT NOT NULL,
  "cardId" TEXT,
  "cardName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DeckArchetypeCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetagameSyncJob" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "totalArchetypes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "MetagameSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");
CREATE INDEX "Deck_archetypeId_idx" ON "Deck"("archetypeId");
CREATE UNIQUE INDEX "DeckCard_deckId_cardId_source_key" ON "DeckCard"("deckId", "cardId", "source");
CREATE INDEX "DeckCard_cardId_idx" ON "DeckCard"("cardId");
CREATE INDEX "DeckValidationResult_deckId_createdAt_idx" ON "DeckValidationResult"("deckId", "createdAt");
CREATE UNIQUE INDEX "DeckArchetype_slug_key" ON "DeckArchetype"("slug");
CREATE INDEX "DeckArchetype_format_idx" ON "DeckArchetype"("format");
CREATE INDEX "DeckArchetype_source_idx" ON "DeckArchetype"("source");
CREATE INDEX "DeckArchetypeCard_archetypeId_idx" ON "DeckArchetypeCard"("archetypeId");
CREATE INDEX "DeckArchetypeCard_cardId_idx" ON "DeckArchetypeCard"("cardId");
CREATE INDEX "DeckArchetypeCard_cardName_idx" ON "DeckArchetypeCard"("cardName");
CREATE INDEX "MetagameSyncJob_source_createdAt_idx" ON "MetagameSyncJob"("source", "createdAt");
CREATE INDEX "MetagameSyncJob_status_idx" ON "MetagameSyncJob"("status");

ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "DeckArchetype"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckValidationResult" ADD CONSTRAINT "DeckValidationResult_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckArchetypeCard" ADD CONSTRAINT "DeckArchetypeCard_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "DeckArchetype"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckArchetypeCard" ADD CONSTRAINT "DeckArchetypeCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
