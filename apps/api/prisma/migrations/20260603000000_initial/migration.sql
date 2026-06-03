-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pricing";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CardCondition" AS ENUM ('NM', 'LP', 'MP', 'HP', 'DMG');

-- CreateEnum
CREATE TYPE "CardLanguage" AS ENUM ('PT_BR', 'EN', 'JA', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'POKEMON_TCG_API', 'TCGDEX', 'LIGAPOKEMON', 'MYPCARDS', 'CONVERTED_INTERNATIONAL');

-- CreateEnum
CREATE TYPE "pricing"."PriceProvider" AS ENUM ('LIGAPOKEMON', 'MYPCARDS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "printedTotal" INTEGER,
    "setTotal" INTEGER,
    "setId" TEXT,
    "setCode" TEXT,
    "setName" TEXT,
    "rarity" TEXT,
    "artist" TEXT,
    "releaseDate" TEXT,
    "nationalPokedexNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regulationMark" TEXT,
    "variants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" "CardLanguage" NOT NULL DEFAULT 'UNKNOWN',
    "imageSmall" TEXT,
    "imageLarge" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "CardCondition" NOT NULL DEFAULT 'NM',
    "variant" TEXT NOT NULL DEFAULT 'normal',
    "foil" BOOLEAN NOT NULL DEFAULT false,
    "language" "CardLanguage" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "cardPriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionFolderItem" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionFolderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "source" "PriceSource" NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "label" TEXT NOT NULL,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."CardPrice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "printedTotal" INTEGER NOT NULL,
    "name" TEXT,
    "setCode" TEXT,
    "setName" TEXT,
    "provider" "pricing"."PriceProvider" NOT NULL,
    "amountBrl" DECIMAL(10,2) NOT NULL,
    "label" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."CardPriceHistory" (
    "id" TEXT NOT NULL,
    "cardPriceId" TEXT NOT NULL,
    "previousAmountBrl" DECIMAL(10,2) NOT NULL,
    "newAmountBrl" DECIMAL(10,2) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."LigaSyncJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "delayMs" INTEGER NOT NULL,
    "totalEditions" INTEGER NOT NULL DEFAULT 0,
    "completedEditions" INTEGER NOT NULL DEFAULT 0,
    "currentEdition" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LigaSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."LigaSyncJobEdition" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "edid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "status" TEXT NOT NULL,
    "cardsFound" INTEGER NOT NULL DEFAULT 0,
    "pricesUpdated" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LigaSyncJobEdition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_provider_providerUserId_key" ON "UserIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_externalId_key" ON "Card"("externalId");

-- CreateIndex
CREATE INDEX "Card_normalizedName_idx" ON "Card"("normalizedName");

-- CreateIndex
CREATE INDEX "Card_number_idx" ON "Card"("number");

-- CreateIndex
CREATE INDEX "Card_printedTotal_idx" ON "Card"("printedTotal");

-- CreateIndex
CREATE INDEX "Card_setId_idx" ON "Card"("setId");

-- CreateIndex
CREATE INDEX "Card_setCode_idx" ON "Card"("setCode");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_idx" ON "CollectionItem"("userId");

-- CreateIndex
CREATE INDEX "CollectionItem_cardId_idx" ON "CollectionItem"("cardId");

-- CreateIndex
CREATE INDEX "CollectionItem_cardPriceId_idx" ON "CollectionItem"("cardPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_userId_cardId_condition_variant_foil_languag_key" ON "CollectionItem"("userId", "cardId", "condition", "variant", "foil", "language");

-- CreateIndex
CREATE INDEX "CollectionFolder_userId_idx" ON "CollectionFolder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionFolder_userId_name_key" ON "CollectionFolder"("userId", "name");

-- CreateIndex
CREATE INDEX "CollectionFolderItem_collectionItemId_idx" ON "CollectionFolderItem"("collectionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionFolderItem_folderId_collectionItemId_key" ON "CollectionFolderItem"("folderId", "collectionItemId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_cardId_source_capturedAt_idx" ON "PriceSnapshot"("cardId", "source", "capturedAt");

-- CreateIndex
CREATE INDEX "CardPrice_setCode_number_printedTotal_idx" ON "pricing"."CardPrice"("setCode", "number", "printedTotal");

-- CreateIndex
CREATE INDEX "CardPrice_number_printedTotal_idx" ON "pricing"."CardPrice"("number", "printedTotal");

-- CreateIndex
CREATE INDEX "CardPrice_provider_idx" ON "pricing"."CardPrice"("provider");

-- CreateIndex
CREATE INDEX "CardPrice_setCode_idx" ON "pricing"."CardPrice"("setCode");

-- CreateIndex
CREATE UNIQUE INDEX "CardPrice_setCode_number_printedTotal_provider_key" ON "pricing"."CardPrice"("setCode", "number", "printedTotal", "provider");

-- CreateIndex
CREATE INDEX "CardPriceHistory_cardPriceId_changedAt_idx" ON "pricing"."CardPriceHistory"("cardPriceId", "changedAt");

-- CreateIndex
CREATE INDEX "LigaSyncJob_status_createdAt_idx" ON "pricing"."LigaSyncJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LigaSyncJobEdition_jobId_status_idx" ON "pricing"."LigaSyncJobEdition"("jobId", "status");

-- CreateIndex
CREATE INDEX "LigaSyncJobEdition_code_idx" ON "pricing"."LigaSyncJobEdition"("code");

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_cardPriceId_fkey" FOREIGN KEY ("cardPriceId") REFERENCES "pricing"."CardPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionFolder" ADD CONSTRAINT "CollectionFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionFolderItem" ADD CONSTRAINT "CollectionFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CollectionFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionFolderItem" ADD CONSTRAINT "CollectionFolderItem_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."CardPriceHistory" ADD CONSTRAINT "CardPriceHistory_cardPriceId_fkey" FOREIGN KEY ("cardPriceId") REFERENCES "pricing"."CardPrice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing"."LigaSyncJobEdition" ADD CONSTRAINT "LigaSyncJobEdition_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "pricing"."LigaSyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

