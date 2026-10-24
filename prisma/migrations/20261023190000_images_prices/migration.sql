-- AlterTable
ALTER TABLE "Package" ADD COLUMN "imageUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN "priceCents" INTEGER;
