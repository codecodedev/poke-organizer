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

CREATE UNIQUE INDEX "LigaEditionCache_edid_code_key" ON "pricing"."LigaEditionCache"("edid", "code");
CREATE INDEX "LigaEditionCache_year_idx" ON "pricing"."LigaEditionCache"("year");
CREATE INDEX "LigaEditionCache_code_idx" ON "pricing"."LigaEditionCache"("code");
