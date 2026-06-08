/*
  Warnings:

  - You are about to drop the `CollectionItemBid` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[profileSlug]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "CollectionItemBid" DROP CONSTRAINT "CollectionItemBid_bidderId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionItemBid" DROP CONSTRAINT "CollectionItemBid_folderItemId_fkey";

-- AlterTable
ALTER TABLE "CollectionCartOffer" ADD COLUMN     "isGlobalOffer" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPublicProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profileBio" TEXT,
ADD COLUMN     "profileSlug" TEXT;

-- DropTable
DROP TABLE "CollectionItemBid";

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "minBidBrl" DECIMAL(10,2) NOT NULL,
    "currentBidBrl" DECIMAL(10,2),
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'OPEN',
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amountBrl" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Auction_shareToken_key" ON "Auction"("shareToken");

-- CreateIndex
CREATE INDEX "Auction_sellerId_idx" ON "Auction"("sellerId");

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX "AuctionBid_auctionId_idx" ON "AuctionBid"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionBid_bidderId_idx" ON "AuctionBid"("bidderId");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
