-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "actualCheckOut" TIMESTAMPTZ(6),
ADD COLUMN     "bookingStatusId" VARCHAR(50) DEFAULT 'bookingStatus_created',
ADD COLUMN     "extraFee" DECIMAL(10,2),
ADD COLUMN     "parkPlace" VARCHAR(50);

-- CreateTable
CREATE TABLE "booking_statuses" (
    "id" VARCHAR(50) NOT NULL,
    "value" VARCHAR(100) NOT NULL,

    CONSTRAINT "booking_statuses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookingStatusId_fkey" FOREIGN KEY ("bookingStatusId") REFERENCES "booking_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
