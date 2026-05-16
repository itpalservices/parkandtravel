-- AlterTable
ALTER TABLE "checkin_transactions" ADD COLUMN     "z_report_id" UUID;

-- AlterTable
ALTER TABLE "completion_transactions" ADD COLUMN     "z_report_id" UUID;

-- CreateTable
CREATE TABLE "z_reports" (
    "id" UUID NOT NULL,
    "target_user_id" VARCHAR(255) NOT NULL,
    "target_user_name" VARCHAR(255) NOT NULL,
    "run_by_user_id" VARCHAR(255) NOT NULL,
    "run_by_user_name" VARCHAR(255) NOT NULL,
    "declared_cash" DECIMAL(10,2) NOT NULL,
    "declared_card" DECIMAL(10,2) NOT NULL,
    "actual_cash" DECIMAL(10,2) NOT NULL,
    "actual_card" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "z_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_z_reports_target_user_id" ON "z_reports"("target_user_id");

-- CreateIndex
CREATE INDEX "idx_z_reports_created_at" ON "z_reports"("created_at");

-- AddForeignKey
ALTER TABLE "completion_transactions" ADD CONSTRAINT "completion_transactions_z_report_id_fkey" FOREIGN KEY ("z_report_id") REFERENCES "z_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_transactions" ADD CONSTRAINT "checkin_transactions_z_report_id_fkey" FOREIGN KEY ("z_report_id") REFERENCES "z_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
