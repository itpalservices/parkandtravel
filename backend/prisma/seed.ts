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

  const bookingStatuses = await prisma.bookingStatus.createMany({
    data: [
      { id: "bookingStatus_created", value: "Created" },
      { id: "bookingStatus_parked", value: "Parked" },
      { id: "bookingStatus_completed", value: "Completed" },
    ],
    skipDuplicates: true,
  });
  console.log(`Created ${bookingStatuses.count} booking statuses`);

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

  const configurationSettings = await prisma.configurationSetting.createMany({
    data: [
      { id: "configurationSetting_availableCovered", value: null },
      { id: "configurationSetting_availableUncovered", value: null },
      { id: "configurationSetting_priceCovered", value: null },
      { id: "configurationSetting_priceUncovered", value: null },
      { id: "configurationSetting_priceWash", value: null },
      { id: "configurationSetting_dayEnd", value: null },
    ],
    skipDuplicates: true,
  });
  console.log(`Created ${configurationSettings.count} configuration settings`);

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
