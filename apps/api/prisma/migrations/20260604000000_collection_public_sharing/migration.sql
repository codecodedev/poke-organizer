-- AlterTable
ALTER TABLE "CollectionFolder"
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CollectionFolder_shareToken_key" ON "CollectionFolder"("shareToken");

-- CreateIndex
CREATE INDEX "CollectionFolder_shareToken_idx" ON "CollectionFolder"("shareToken");
