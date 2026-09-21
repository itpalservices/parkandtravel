import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { generateShiftSummaryZpl } from "../services/pdf.service";
import { getOpenShiftForUser, getOpenShiftTransactions, getOpenShiftTotals } from "../services/shift-summary.service";

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

router.get("/summary", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can access shift summary" });
      return;
    }

    const openShift = await getOpenShiftForUser(authUser.sub);

    if (!openShift) {
      res.json({ shiftId: null, transactions: [], totals: [] });
      return;
    }

    const [transactions, totals] = await Promise.all([
      getOpenShiftTransactions(openShift.id),
      getOpenShiftTotals(openShift.id),
    ]);

    res.json({ shiftId: openShift.id, transactions, totals });
  } catch (error: any) {
    console.error("Error fetching shift summary:", error.message);
    res.status(500).json({ error: "Failed to fetch shift summary" });
  }
});

router.get("/summary/zpl", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can print a shift summary" });
      return;
    }

    const openShift = await getOpenShiftForUser(authUser.sub);

    if (!openShift) {
      res.status(404).json({ error: "No open shift found" });
      return;
    }

    const totals = await getOpenShiftTotals(openShift.id);
    const cashierName = (req.query.actorName as string) || authUser.email;

    const zpl = await generateShiftSummaryZpl({
      cashierName,
      shiftStart: openShift.shiftStart,
      shiftEnd: new Date(),
      totals,
    });

    res.set({ "Content-Type": "text/plain" });
    res.send(zpl);
  } catch (error: any) {
    console.error("Error generating shift summary ZPL:", error.message);
    res.status(500).json({ error: "Failed to generate shift summary" });
  }
});

export default router;
