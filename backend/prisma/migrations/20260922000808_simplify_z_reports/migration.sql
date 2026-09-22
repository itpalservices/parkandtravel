-- Z-Report redesign: no per-employee target, no declared/actual reconciliation.
-- Safe to drop outright — no z_reports rows exist yet in any environment migrated so far.

-- DropIndex
DROP INDEX IF EXISTS "idx_z_reports_target_user_id";

-- AlterTable
ALTER TABLE "z_reports"
  DROP COLUMN "target_user_id",
  DROP COLUMN "target_user_name",
  DROP COLUMN "declared_cash",
  DROP COLUMN "declared_card",
  DROP COLUMN "actual_cash",
  DROP COLUMN "actual_card";
