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
