-- CreateTable
CREATE TABLE "receipts_header" (
    "id" UUID NOT NULL,
    "receipt_seq" SERIAL NOT NULL,
    "receipt_number" VARCHAR(20),
    "booking_id" UUID NOT NULL,
    "transaction_id" BIGINT NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_header_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts_lines" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "line_type" VARCHAR(20) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "receipts_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_header_receipt_seq_key" ON "receipts_header"("receipt_seq");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_header_receipt_number_key" ON "receipts_header"("receipt_number");

-- AddForeignKey
ALTER TABLE "receipts_header" ADD CONSTRAINT "receipts_header_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts_lines" ADD CONSTRAINT "receipts_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts_header"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
