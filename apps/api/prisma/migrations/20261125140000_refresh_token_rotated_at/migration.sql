-- Reuse interval for refresh-token rotation (docs/adr/0003).
ALTER TABLE "RefreshToken" ADD COLUMN "rotatedAt" TIMESTAMPTZ(3);
