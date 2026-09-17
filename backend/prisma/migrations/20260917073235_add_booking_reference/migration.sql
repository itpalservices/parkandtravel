-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "booking_seq" SERIAL;
ALTER TABLE "bookings" ADD COLUMN "booking_reference" VARCHAR(20);

-- Backfill booking_seq deterministically, ordered by createdAt, instead of relying on
-- physical row order (what ADD COLUMN ... SERIAL would assign by default)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
  FROM "bookings"
)
UPDATE "bookings" b
SET "booking_seq" = ordered.rn
FROM ordered
WHERE b.id = ordered.id;

-- Keep the sequence in sync so the next created booking continues after the highest backfilled value
SELECT setval(pg_get_serial_sequence('"bookings"', 'booking_seq'), COALESCE((SELECT MAX("booking_seq") FROM "bookings"), 0) + 1, false);

-- Backfill booking_reference from each booking's own check-in date (dateFrom) + booking_seq
UPDATE "bookings"
SET "booking_reference" = 'PT-' || to_char("dateFrom", 'YYMMDD') || '-' || lpad("booking_seq"::text, 5, '0');

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "booking_seq" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_seq_key" ON "bookings"("booking_seq");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_reference_key" ON "bookings"("booking_reference");
