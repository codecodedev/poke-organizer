ALTER TABLE "public"."CollectionFolderItem"
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

UPDATE "public"."CollectionFolderItem" AS folder_item
SET "quantity" = GREATEST(1, collection_item."quantity")
FROM "public"."CollectionItem" AS collection_item
WHERE collection_item."id" = folder_item."collectionItemId";
