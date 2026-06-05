CREATE TYPE "public"."CollectionOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

ALTER TABLE "public"."CollectionFolder"
ADD COLUMN "isStore" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."CollectionFolderItem"
ADD COLUMN "manualPriceBrl" DECIMAL(10,2),
ADD COLUMN "isSold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "soldPriceBrl" DECIMAL(10,2),
ADD COLUMN "soldAt" TIMESTAMP(3),
ADD COLUMN "soldToUserId" TEXT;

CREATE TABLE "public"."CollectionItemBid" (
  "id" TEXT NOT NULL,
  "folderItemId" TEXT NOT NULL,
  "bidderId" TEXT NOT NULL,
  "amountBrl" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionItemBid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CollectionCartOffer" (
  "id" TEXT NOT NULL,
  "folderId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "status" "public"."CollectionOfferStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "totalOfferBrl" DECIMAL(10,2) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionCartOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CollectionCartOfferItem" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "folderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "amountBrl" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "CollectionCartOfferItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionFolderItem_soldToUserId_idx" ON "public"."CollectionFolderItem"("soldToUserId");
CREATE INDEX "CollectionItemBid_folderItemId_createdAt_idx" ON "public"."CollectionItemBid"("folderItemId", "createdAt");
CREATE INDEX "CollectionItemBid_bidderId_idx" ON "public"."CollectionItemBid"("bidderId");
CREATE INDEX "CollectionCartOffer_folderId_status_idx" ON "public"."CollectionCartOffer"("folderId", "status");
CREATE INDEX "CollectionCartOffer_buyerId_idx" ON "public"."CollectionCartOffer"("buyerId");
CREATE INDEX "CollectionCartOfferItem_offerId_idx" ON "public"."CollectionCartOfferItem"("offerId");
CREATE INDEX "CollectionCartOfferItem_folderItemId_idx" ON "public"."CollectionCartOfferItem"("folderItemId");

ALTER TABLE "public"."CollectionItemBid"
ADD CONSTRAINT "CollectionItemBid_folderItemId_fkey" FOREIGN KEY ("folderItemId") REFERENCES "public"."CollectionFolderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CollectionItemBid"
ADD CONSTRAINT "CollectionItemBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CollectionCartOffer"
ADD CONSTRAINT "CollectionCartOffer_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "public"."CollectionFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CollectionCartOffer"
ADD CONSTRAINT "CollectionCartOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CollectionCartOfferItem"
ADD CONSTRAINT "CollectionCartOfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."CollectionCartOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."CollectionCartOfferItem"
ADD CONSTRAINT "CollectionCartOfferItem_folderItemId_fkey" FOREIGN KEY ("folderItemId") REFERENCES "public"."CollectionFolderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
