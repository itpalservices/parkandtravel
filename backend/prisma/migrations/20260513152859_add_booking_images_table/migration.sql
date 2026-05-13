-- CreateTable
CREATE TABLE "booking_images" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "booking_images" ADD CONSTRAINT "booking_images_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
