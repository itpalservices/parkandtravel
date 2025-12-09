-- CreateTable
CREATE TABLE "parking_types" (
    "id" VARCHAR(25) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "parking_types_pkey" PRIMARY KEY ("id")
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
    "plateNo" VARCHAR(10),
    "carBrand" VARCHAR(100),
    "carModel" VARCHAR(100),
    "carColor" VARCHAR(100),
    "parkingTypeId" VARCHAR(25),
    "adults" INTEGER,
    "deleteflag" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parkingTypeId_fkey" FOREIGN KEY ("parkingTypeId") REFERENCES "parking_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
