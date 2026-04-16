import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";

const router = Router();

router.post("/start", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can start shifts" });
      return;
    }

    const userId = authUser.sub;

    const existing = await prisma.shift.findFirst({
      where: { userId, status: "open" },
      select: { id: true },
    });

    if (existing) {
      res.json({ success: true, shiftId: existing.id, created: false });
      return;
    }

    const now = new Date();
    const shift = await prisma.shift.create({
      data: {
        userId,
        shiftStart: now,
        lastActivityAt: now,
        status: "open",
      },
    });

    res.status(201).json({ success: true, shiftId: shift.id, created: true });
  } catch (error: any) {
    console.error("Error starting shift:", error.message);
    res.status(500).json({ error: "Failed to start shift" });
  }
});

router.post("/end", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can end shifts" });
      return;
    }

    const userId = authUser.sub;
    const now = new Date();

    const updated = await prisma.shift.updateMany({
      where: { userId, status: "open" },
      data: {
        shiftEnd: now,
        lastActivityAt: now,
        status: "closed",
      },
    });

    res.json({ success: true, closedCount: updated.count });
  } catch (error: any) {
    console.error("Error ending shift:", error.message);
    res.status(500).json({ error: "Failed to end shift" });
  }
});

export default router;
