import app from "./app";
import { prisma } from "./lib/prisma";
import { startShiftAutoCloseJob } from "./jobs/shift-auto-close.job";

const PORT = process.env.PORT || 5000;

async function testDatabaseConnection() {
  try {
    const parkingTypes = await prisma.parkingType.count();
    const bookings = await prisma.booking.count();
    console.log(`Database connected successfully!`);
    console.log(`Found ${parkingTypes} parking types and ${bookings} bookings`);
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  testDatabaseConnection();
  startShiftAutoCloseJob();
});

export { prisma };
