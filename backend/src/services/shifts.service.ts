import { prisma } from "../lib/prisma";

export async function updateShiftActivity(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await prisma.shift.updateMany({
      where: { userId, status: "open" },
      data: { lastActivityAt: new Date() },
    });
  } catch (err) {
    console.error("Failed to update shift activity for user", userId, err);
  }
}
