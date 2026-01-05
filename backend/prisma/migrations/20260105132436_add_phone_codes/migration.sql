-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "phoneCodeId" UUID;

-- CreateTable
CREATE TABLE "phone_codes" (
    "id" UUID NOT NULL,
    "isoCode" VARCHAR(5) NOT NULL,
    "phoneCode" VARCHAR(10) NOT NULL,

    CONSTRAINT "phone_codes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_phoneCodeId_fkey" FOREIGN KEY ("phoneCodeId") REFERENCES "phone_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
