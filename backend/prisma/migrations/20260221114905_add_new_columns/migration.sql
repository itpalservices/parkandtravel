-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "keepKeys" BOOLEAN DEFAULT false,
ADD COLUMN     "mileageKm" INTEGER,
ADD COLUMN     "parkingComments" TEXT;
