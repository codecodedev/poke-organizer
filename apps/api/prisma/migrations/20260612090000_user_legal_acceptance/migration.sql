-- Add legal acceptance fields to users
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersion" TEXT,
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyVersion" TEXT,
ADD COLUMN "legalAcceptedIp" TEXT,
ADD COLUMN "legalAcceptedUserAgent" TEXT;
