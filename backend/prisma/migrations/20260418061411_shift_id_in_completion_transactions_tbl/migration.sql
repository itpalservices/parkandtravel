-- AlterTable
ALTER TABLE "completion_transactions" ADD COLUMN     "shift_id" INTEGER;

-- CreateTable
CREATE TABLE "shifts" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "shift_start" TIMESTAMPTZ(6) NOT NULL,
    "shift_end" TIMESTAMPTZ(6),
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_shifts_user_id" ON "shifts"("user_id");

-- CreateIndex
CREATE INDEX "idx_shifts_status" ON "shifts"("status");

-- AddForeignKey
ALTER TABLE "completion_transactions" ADD CONSTRAINT "completion_transactions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
