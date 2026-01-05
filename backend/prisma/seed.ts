import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const parkingTypes = await prisma.parkingType.createMany({
    data: [
      { id: "parkingType_covered", name: "Covered" },
      { id: "parkingType_uncovered", name: "Un Covered" },
    ],
    skipDuplicates: true,
  });
  console.log(`Created ${parkingTypes.count} parking types`);

  const phoneCodes = await prisma.phoneCode.createMany({
    data: [
      { isoCode: "CY", phoneCode: "+357" },
      { isoCode: "GR", phoneCode: "+30" },
      { isoCode: "GB", phoneCode: "+44" },
      { isoCode: "US", phoneCode: "+1" },
      { isoCode: "DE", phoneCode: "+49" },
      { isoCode: "FR", phoneCode: "+33" },
      { isoCode: "IT", phoneCode: "+39" },
      { isoCode: "ES", phoneCode: "+34" },
      { isoCode: "PT", phoneCode: "+351" },
      { isoCode: "NL", phoneCode: "+31" },
      { isoCode: "BE", phoneCode: "+32" },
      { isoCode: "AT", phoneCode: "+43" },
      { isoCode: "CH", phoneCode: "+41" },
      { isoCode: "SE", phoneCode: "+46" },
      { isoCode: "NO", phoneCode: "+47" },
      { isoCode: "DK", phoneCode: "+45" },
      { isoCode: "FI", phoneCode: "+358" },
      { isoCode: "IE", phoneCode: "+353" },
      { isoCode: "PL", phoneCode: "+48" },
      { isoCode: "RU", phoneCode: "+7" },
      { isoCode: "AU", phoneCode: "+61" },
      { isoCode: "NZ", phoneCode: "+64" },
      { isoCode: "CA", phoneCode: "+1" },
      { isoCode: "IL", phoneCode: "+972" },
      { isoCode: "AE", phoneCode: "+971" },
      { isoCode: "SA", phoneCode: "+966" },
      { isoCode: "EG", phoneCode: "+20" },
      { isoCode: "ZA", phoneCode: "+27" },
      { isoCode: "IN", phoneCode: "+91" },
      { isoCode: "CN", phoneCode: "+86" },
      { isoCode: "JP", phoneCode: "+81" },
      { isoCode: "KR", phoneCode: "+82" },
      { isoCode: "BR", phoneCode: "+55" },
      { isoCode: "MX", phoneCode: "+52" },
      { isoCode: "AR", phoneCode: "+54" },
    ],
    skipDuplicates: true,
  });
  console.log(`Created ${phoneCodes.count} phone codes`);

  const today = new Date();
  const futureDate = (daysFromNow: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  const bookings = [
    {
      name: "John",
      surname: "Smith",
      email: "john.smith@email.com",
      returnFlight: "BA1234",
      dateFrom: futureDate(5),
      dateTo: futureDate(12),
      mobile: "+1234567890",
      plateNo: "ABC123",
      carBrand: "Toyota",
      carModel: "Camry",
      carColor: "Silver",
      parkingTypeId: "parkingType_covered",
      adults: 2,
      deleteflag: 0,
    },
    {
      name: "Jane",
      surname: "Doe",
      email: "jane.doe@email.com",
      returnFlight: "LH5678",
      dateFrom: futureDate(3),
      dateTo: futureDate(10),
      mobile: "+0987654321",
      plateNo: "XYZ789",
      carBrand: "Honda",
      carModel: "Accord",
      carColor: "Black",
      parkingTypeId: "parkingType_uncovered",
      adults: 1,
      deleteflag: 0,
    },
    {
      name: "Michael",
      surname: "Johnson",
      email: "m.johnson@email.com",
      returnFlight: "AF9012",
      dateFrom: futureDate(7),
      dateTo: futureDate(14),
      mobile: "+1122334455",
      plateNo: "DEF456",
      carBrand: "Ford",
      carModel: "Focus",
      carColor: "Blue",
      parkingTypeId: "parkingType_covered",
      adults: 3,
      deleteflag: 0,
    },
    {
      name: "Sarah",
      surname: "Williams",
      email: "sarah.w@email.com",
      returnFlight: "EK3456",
      dateFrom: futureDate(2),
      dateTo: futureDate(8),
      mobile: "+5566778899",
      plateNo: "GHI012",
      carBrand: "BMW",
      carModel: "3 Series",
      carColor: "White",
      parkingTypeId: "parkingType_uncovered",
      adults: 2,
      deleteflag: 0,
    },
    {
      name: "David",
      surname: "Brown",
      email: "david.brown@email.com",
      returnFlight: "QF7890",
      dateFrom: futureDate(10),
      dateTo: futureDate(17),
      mobile: "+9988776655",
      plateNo: "JKL345",
      carBrand: "Mercedes",
      carModel: "C-Class",
      carColor: "Gray",
      parkingTypeId: "parkingType_covered",
      adults: 4,
      deleteflag: 0,
    },
  ];

  for (const booking of bookings) {
    await prisma.booking.create({ data: booking });
  }
  console.log(`Created ${bookings.length} sample bookings`);

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
