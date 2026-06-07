-- AlterTable
ALTER TABLE "CollectionFolder" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CollectionView" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "viewerId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing"."LigaEditionCache" (
    "id" TEXT NOT NULL,
    "edid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "searchUrl" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigaEditionCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionView_folderId_viewedAt_idx" ON "CollectionView"("folderId", "viewedAt");

-- CreateIndex
CREATE INDEX "CollectionView_ip_folderId_viewedAt_idx" ON "CollectionView"("ip", "folderId", "viewedAt");

-- CreateIndex
CREATE INDEX "LigaEditionCache_year_idx" ON "pricing"."LigaEditionCache"("year");

-- CreateIndex
CREATE INDEX "LigaEditionCache_code_idx" ON "pricing"."LigaEditionCache"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LigaEditionCache_edid_code_key" ON "pricing"."LigaEditionCache"("edid", "code");

-- CreateIndex
CREATE INDEX "CollectionFolder_viewCount_idx" ON "CollectionFolder"("viewCount" DESC);

-- AddForeignKey
ALTER TABLE "CollectionView" ADD CONSTRAINT "CollectionView_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CollectionFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
