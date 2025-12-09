import app from "./app";
import { prisma } from "./lib/prisma";

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
});

export { prisma };
