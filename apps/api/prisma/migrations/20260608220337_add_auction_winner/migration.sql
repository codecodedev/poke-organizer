/*
  Warnings:

  - A unique constraint covering the columns `[winningBidId]` on the table `Auction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "winningBidId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Auction_winningBidId_key" ON "Auction"("winningBidId");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "AuctionBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
