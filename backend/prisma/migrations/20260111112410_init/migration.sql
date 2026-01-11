-- CreateTable
CREATE TABLE "parking_types" (
    "id" VARCHAR(25) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "parking_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_codes" (
    "id" UUID NOT NULL,
    "isoCode" VARCHAR(5) NOT NULL,
    "phoneCode" VARCHAR(10) NOT NULL,

    CONSTRAINT "phone_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "surname" VARCHAR(250) NOT NULL,
    "email" VARCHAR(250),
    "returnFlight" VARCHAR(10),
    "dateFrom" DATE NOT NULL,
    "timeFrom" TIME(6),
    "dateTo" DATE NOT NULL,
    "timeTo" TIME(6),
    "mobile" VARCHAR(20),
    "phoneCodeId" UUID,
    "plateNo" VARCHAR(10),
    "carBrand" VARCHAR(100),
    "carModel" VARCHAR(100),
    "carColor" VARCHAR(100),
    "parkingTypeId" VARCHAR(25),
    "adults" INTEGER,
    "washService" BOOLEAN NOT NULL DEFAULT false,
    "finalPrice" DECIMAL(10,2),
    "dropOffOption" VARCHAR(20),
    "pickUpOption" VARCHAR(20),
    "deleteflag" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_settings" (
    "id" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500),

    CONSTRAINT "configuration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" VARCHAR(255) NOT NULL,
    "carBrand" VARCHAR(100) NOT NULL,
    "carModel" VARCHAR(100) NOT NULL,
    "carColor" VARCHAR(100) NOT NULL,
    "plateNo" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parkingTypeId_fkey" FOREIGN KEY ("parkingTypeId") REFERENCES "parking_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_phoneCodeId_fkey" FOREIGN KEY ("phoneCodeId") REFERENCES "phone_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
