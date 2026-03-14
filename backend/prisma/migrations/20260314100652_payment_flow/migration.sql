-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "payment_status" VARCHAR(20),
ADD COLUMN     "wl_transaction_id" BIGINT;

-- CreateTable
CREATE TABLE "pending_bookings" (
    "id" UUID NOT NULL,
    "wl_transaction_id" BIGINT,
    "form_data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_bookings_pkey" PRIMARY KEY ("id")
);
