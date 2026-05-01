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

interface SummaryTransactionRow {
  id: string;
  datetime: Date;
  amount: string;
  payment_method: string;
  notes: string | null;
  plate_no: string | null;
  type: string;
}

interface SummaryTotalsRow {
  payment_method: string;
  total: string;
  count: bigint;
}

router.get("/summary", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can access shift summary" });
      return;
    }

    const openShift = await prisma.shift.findFirst({
      where: { userId: authUser.sub, status: "open" },
      select: { id: true },
    });

    if (!openShift) {
      res.json({ shiftId: null, transactions: [], totals: [] });
      return;
    }

    const shiftId = openShift.id;

    const [transactions, totalsRaw] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, datetime, amount, payment_method, notes, plate_no, type
        FROM (
          SELECT ct.id, ct.datetime, ct.amount, ct.payment_method, ct.notes,
                 b."plateNo" AS plate_no, 'checkout' AS type
          FROM completion_transactions ct
          LEFT JOIN bookings b ON b.id = ct.booking_id
          WHERE ct.shift_id = ${shiftId} AND ct.amount > 0
          UNION ALL
          SELECT kit.id, kit.datetime, kit.amount, kit.payment_method, kit.notes,
                 b."plateNo" AS plate_no, 'checkin' AS type
          FROM checkin_transactions kit
          LEFT JOIN bookings b ON b.id = kit.booking_id
          WHERE kit.shift_id = ${shiftId} AND kit.amount > 0
        ) combined
        ORDER BY datetime DESC
      `.then((r) => r as SummaryTransactionRow[]),
      prisma.$queryRaw`
        SELECT payment_method, SUM(amount) AS total, COUNT(*) AS count
        FROM (
          SELECT payment_method, amount FROM completion_transactions WHERE shift_id = ${shiftId} AND amount > 0
          UNION ALL
          SELECT payment_method, amount FROM checkin_transactions WHERE shift_id = ${shiftId} AND amount > 0
        ) combined
        GROUP BY payment_method
        ORDER BY payment_method
      `.then((r) => r as SummaryTotalsRow[]),
    ]);

    res.json({
      shiftId,
      transactions: transactions.map((t) => ({
        id: t.id,
        datetime: t.datetime,
        amount: Number(t.amount),
        paymentMethod: t.payment_method,
        notes: t.notes,
        plateNo: t.plate_no,
        type: t.type,
      })),
      totals: totalsRaw.map((t) => ({
        paymentMethod: t.payment_method,
        total: Number(t.total),
        count: Number(t.count),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching shift summary:", error.message);
    res.status(500).json({ error: "Failed to fetch shift summary" });
  }
});

export default router;
