-- Z-Report VAT: snapshot the VAT rate in force when each report is created, so later changes to
-- configurationSetting_tax only affect new reports. Existing reports are backfilled with the
-- current rate.

-- AlterTable
ALTER TABLE "z_reports" ADD COLUMN "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Backfill
UPDATE "z_reports"
SET "vat_rate" = COALESCE(
  (SELECT NULLIF(TRIM(value), '')::numeric FROM configuration_settings WHERE id = 'configurationSetting_tax'),
  0
);
