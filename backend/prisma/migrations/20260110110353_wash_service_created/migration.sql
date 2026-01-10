-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "finalPrice" DECIMAL(10,2),
ADD COLUMN     "washService" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "configuration_settings" (
    "id" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500),

    CONSTRAINT "configuration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" UUID NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "carBrand" VARCHAR(100) NOT NULL,
    "carModel" VARCHAR(100) NOT NULL,
    "carColor" VARCHAR(100) NOT NULL,
    "plateNo" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);
