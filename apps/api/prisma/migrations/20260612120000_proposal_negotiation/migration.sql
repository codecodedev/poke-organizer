-- AlterEnum
ALTER TYPE "CollectionOfferStatus" ADD VALUE IF NOT EXISTS 'COUNTERED';
ALTER TYPE "CollectionOfferStatus" ADD VALUE IF NOT EXISTS 'BUYER_ACCEPTED';

-- CreateEnum
CREATE TYPE "CollectionOfferEventType" AS ENUM (
    'MESSAGE',
    'INITIAL_OFFER',
    'COUNTER_OFFER',
    'BUYER_ACCEPTED',
    'SELLER_ACCEPTED',
    'REJECTED'
);

-- CreateTable
CREATE TABLE "CollectionCartOfferEvent" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "CollectionOfferEventType" NOT NULL DEFAULT 'MESSAGE',
    "message" TEXT,
    "proposedTotalBrl" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionCartOfferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionCartOfferEvent_offerId_createdAt_idx" ON "CollectionCartOfferEvent"("offerId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionCartOfferEvent_senderId_idx" ON "CollectionCartOfferEvent"("senderId");

-- AddForeignKey
ALTER TABLE "CollectionCartOfferEvent" ADD CONSTRAINT "CollectionCartOfferEvent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CollectionCartOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionCartOfferEvent" ADD CONSTRAINT "CollectionCartOfferEvent_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
