import { prisma } from "../lib/prisma";

export async function getOpenShiftId(userId: string): Promise<number | null> {
  if (!userId) return null;
  try {
    const shift = await prisma.shift.findFirst({
      where: { userId, status: "open" },
      select: { id: true },
    });
    return shift?.id ?? null;
  } catch (err) {
    console.error("Failed to get open shift for user", userId, err);
    return null;
  }
}

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
