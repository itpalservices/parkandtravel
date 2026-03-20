/*
  Warnings:

  - You are about to drop the column `payment_status` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `wl_transaction_id` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "payment_status",
DROP COLUMN "wl_transaction_id";

-- CreateTable
CREATE TABLE "wallee_transactions" (
    "id" BIGINT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "bookingId" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallee_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "wallee_transactions" ADD CONSTRAINT "wallee_transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
