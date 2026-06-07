-- CreateTable
CREATE TABLE "CollectionFolderPermission" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionFolderPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionFolderPermission_userId_idx" ON "CollectionFolderPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionFolderPermission_folderId_userId_key" ON "CollectionFolderPermission"("folderId", "userId");

-- AddForeignKey
ALTER TABLE "CollectionFolderPermission" ADD CONSTRAINT "CollectionFolderPermission_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CollectionFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionFolderPermission" ADD CONSTRAINT "CollectionFolderPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
