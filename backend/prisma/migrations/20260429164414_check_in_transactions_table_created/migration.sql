-- CreateTable
CREATE TABLE "checkin_transactions" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(10,2) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "payment_method" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "shift_id" INTEGER,

    CONSTRAINT "checkin_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "checkin_transactions" ADD CONSTRAINT "checkin_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_transactions" ADD CONSTRAINT "checkin_transactions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
