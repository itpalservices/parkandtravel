import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getAllEmployees, getUserById } from "../services/auth0.service";
import {
  getOpenShiftForUser,
  getOpenShiftTransactions,
  getOpenShiftTotals,
  OpenShiftTransaction,
  OpenShiftTotal,
} from "../services/shift-summary.service";

interface TransactionRow {
  id: string;
  booking_id: string;
  datetime: Date;
  amount: string;
  payment_method: string;
  notes: string | null;
  plate_no: string | null;
  type: string;
}

interface TotalsRow {
  payment_method: string;
  total: string;
}

function mapTransaction(t: TransactionRow) {
  return {
    id: t.id,
    bookingId: t.booking_id,
    datetime: t.datetime,
    amount: Number(t.amount),
    paymentMethod: t.payment_method,
    notes: t.notes,
    plateNo: t.plate_no,
    type: t.type,
  };
}

async function fetchTransactionsByUserAndZReport(userId: string, zReportId: string | null) {
  const condition = zReportId
    ? `ct.z_report_id = '${zReportId}'::uuid`
    : `ct.user_id = '${userId}' AND ct.z_report_id IS NULL`;

  // Use parameterized queries to avoid injection
  if (zReportId) {
    return prisma.$queryRaw`
      SELECT id, booking_id, datetime, amount, payment_method, notes, plate_no, type
      FROM (
        SELECT ct.id, ct.booking_id, ct.datetime, ct.amount, ct.payment_method, ct.notes,
               b."plateNo" AS plate_no, 'checkout' AS type
        FROM completion_transactions ct
        LEFT JOIN bookings b ON b.id = ct.booking_id
        WHERE ct.z_report_id = ${zReportId}::uuid
        UNION ALL
        SELECT kit.id, kit.booking_id, kit.datetime, kit.amount, kit.payment_method, kit.notes,
               b."plateNo" AS plate_no, 'checkin' AS type
        FROM checkin_transactions kit
        LEFT JOIN bookings b ON b.id = kit.booking_id
        WHERE kit.z_report_id = ${zReportId}::uuid
      ) combined
      ORDER BY datetime DESC
    ` as Promise<TransactionRow[]>;
  }

  return prisma.$queryRaw`
    SELECT id, booking_id, datetime, amount, payment_method, notes, plate_no, type
    FROM (
      SELECT ct.id, ct.booking_id, ct.datetime, ct.amount, ct.payment_method, ct.notes,
             b."plateNo" AS plate_no, 'checkout' AS type
      FROM completion_transactions ct
      LEFT JOIN bookings b ON b.id = ct.booking_id
      WHERE ct.user_id = ${userId} AND ct.z_report_id IS NULL
      UNION ALL
      SELECT kit.id, kit.booking_id, kit.datetime, kit.amount, kit.payment_method, kit.notes,
             b."plateNo" AS plate_no, 'checkin' AS type
      FROM checkin_transactions kit
      LEFT JOIN bookings b ON b.id = kit.booking_id
      WHERE kit.user_id = ${userId} AND kit.z_report_id IS NULL
    ) combined
    ORDER BY datetime DESC
  ` as Promise<TransactionRow[]>;
}

export interface OpenShiftEmployeeSummary {
  userId: string;
  employeeName: string;
  shiftId: number;
  shiftStart: Date;
  transactions: OpenShiftTransaction[];
  totals: OpenShiftTotal[];
  employeeTotal: number;
}

/** Admin view: one section per employee who currently has a shift open (including the admin
 *  themselves, if they have one) — oldest open shift first, so a forgotten/stale shift surfaces
 *  at the top. Each section is exactly what that employee would see on their own X Report. */
async function getAllOpenShiftsSummary(): Promise<{
  employees: OpenShiftEmployeeSummary[];
  grandTotal: number;
  grandTotals: OpenShiftTotal[];
}> {
  const openShifts = await prisma.shift.findMany({
    where: { status: "open" },
    orderBy: { shiftStart: "asc" },
    select: { id: true, userId: true, shiftStart: true },
  });

  if (openShifts.length === 0) {
    return { employees: [], grandTotal: 0, grandTotals: [] };
  }

  const employeeList = await getAllEmployees().catch(() => []);
  const employeeMap = new Map(employeeList.map((e) => [e.userId, e]));

  const employees: OpenShiftEmployeeSummary[] = await Promise.all(
    openShifts.map(async (shift) => {
      const [transactions, totals] = await Promise.all([
        getOpenShiftTransactions(shift.id),
        getOpenShiftTotals(shift.id),
      ]);
      const employee = employeeMap.get(shift.userId);
      const employeeName = employee ? `${employee.name} ${employee.surname}`.trim() : shift.userId;

      return {
        userId: shift.userId,
        employeeName,
        shiftId: shift.id,
        shiftStart: shift.shiftStart,
        transactions,
        totals,
        employeeTotal: totals.reduce((sum, t) => sum + t.total, 0),
      };
    })
  );

  const grandTotalsMap = new Map<string, { total: number; count: number }>();
  for (const emp of employees) {
    for (const t of emp.totals) {
      const existing = grandTotalsMap.get(t.paymentMethod) ?? { total: 0, count: 0 };
      existing.total += t.total;
      existing.count += t.count;
      grandTotalsMap.set(t.paymentMethod, existing);
    }
  }
  const grandTotals: OpenShiftTotal[] = Array.from(grandTotalsMap.entries())
    .map(([paymentMethod, v]) => ({ paymentMethod, total: v.total, count: v.count }))
    .sort((a, b) => a.paymentMethod.localeCompare(b.paymentMethod));

  const grandTotal = grandTotals.reduce((sum, t) => sum + t.total, 0);

  return { employees, grandTotal, grandTotals };
}

export async function getXReport(req: Request, res: Response) {
  const userId = req.authUser?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Drivers see a live view of their own currently-open shift only — the same data as the
  // logout modal's shift summary, gone the moment that shift is closed.
  if (req.authUser?.role === "driver") {
    try {
      const openShift = await getOpenShiftForUser(userId);
      if (!openShift) {
        res.json({ shiftId: null, transactions: [], totals: [] });
        return;
      }

      const [transactions, totals] = await Promise.all([
        getOpenShiftTransactions(openShift.id),
        getOpenShiftTotals(openShift.id),
      ]);

      res.json({ shiftId: openShift.id, transactions, totals });
    } catch (error) {
      console.error("getXReport (driver) error:", error);
      res.status(500).json({ error: "Failed to fetch X report" });
    }
    return;
  }

  // Admin view: one section per employee (including the admin) who currently has an open shift.
  try {
    const summary = await getAllOpenShiftsSummary();
    res.json(summary);
  } catch (error) {
    console.error("getXReport (admin) error:", error);
    res.status(500).json({ error: "Failed to fetch X report" });
  }
}

export async function getZReportEmployees(req: Request, res: Response) {
  const currentUserId = req.authUser?.sub;
  if (!currentUserId || req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  try {
    const employees = await getAllEmployees();
    res.json(employees.filter((e) => e.userId !== currentUserId));
  } catch (error) {
    console.error("getZReportEmployees error:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
}

export async function createZReport(req: Request, res: Response) {
  const adminId = req.authUser?.sub;
  const adminEmail = req.authUser?.email;
  if (!adminId || req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const { targetUserId, targetUserName, declaredCash, declaredCard } = req.body;

  if (!targetUserId || !targetUserName) {
    res.status(400).json({ error: "targetUserId and targetUserName are required" });
    return;
  }
  if (targetUserId === adminId) {
    res.status(400).json({ error: "Cannot run Z report for yourself" });
    return;
  }
  if (typeof declaredCash !== "number" || typeof declaredCard !== "number" || declaredCash < 0 || declaredCard < 0) {
    res.status(400).json({ error: "declaredCash and declaredCard must be non-negative numbers" });
    return;
  }

  try {
    const adminUser = await getUserById(adminId).catch(() => null);
    const adminName = adminUser
      ? `${adminUser.user_metadata?.name || adminUser.given_name || ""} ${adminUser.user_metadata?.surname || adminUser.family_name || ""}`.trim() || adminEmail || adminId
      : adminEmail || adminId;

    const totalsRaw = (await prisma.$queryRaw`
      SELECT payment_method, SUM(amount) AS total
      FROM (
        SELECT payment_method, amount FROM completion_transactions
        WHERE user_id = ${targetUserId} AND z_report_id IS NULL
        UNION ALL
        SELECT payment_method, amount FROM checkin_transactions
        WHERE user_id = ${targetUserId} AND z_report_id IS NULL
      ) combined
      GROUP BY payment_method
    `) as TotalsRow[];

    const actualsMap: Record<string, number> = {};
    totalsRaw.forEach((t) => {
      actualsMap[t.payment_method] = Number(t.total);
    });

    const actualCash = actualsMap["cash"] || 0;
    const actualCard = actualsMap["card"] || 0;

    if (actualCash === 0 && actualCard === 0) {
      res.status(400).json({ error: "No unreported transactions found for this employee. Z report cannot be created." });
      return;
    }

    const zReport = await prisma.$transaction(async (tx) => {
      const report = await tx.zReport.create({
        data: {
          targetUserId,
          targetUserName,
          runByUserId: adminId,
          runByUserName: adminName,
          declaredCash,
          declaredCard,
          actualCash,
          actualCard,
        },
      });

      await tx.$executeRaw`
        UPDATE completion_transactions
        SET z_report_id = ${report.id}::uuid
        WHERE user_id = ${targetUserId} AND z_report_id IS NULL
      `;

      await tx.$executeRaw`
        UPDATE checkin_transactions
        SET z_report_id = ${report.id}::uuid
        WHERE user_id = ${targetUserId} AND z_report_id IS NULL
      `;

      return report;
    });

    const transactions = (await fetchTransactionsByUserAndZReport(targetUserId, zReport.id)) as TransactionRow[];

    res.status(201).json({
      id: zReport.id,
      targetUserId: zReport.targetUserId,
      targetUserName: zReport.targetUserName,
      runByUserId: zReport.runByUserId,
      runByUserName: zReport.runByUserName,
      declaredCash: Number(zReport.declaredCash),
      declaredCard: Number(zReport.declaredCard),
      actualCash: Number(zReport.actualCash),
      actualCard: Number(zReport.actualCard),
      createdAt: zReport.createdAt,
      transactions: transactions.map(mapTransaction),
    });
  } catch (error) {
    console.error("createZReport error:", error);
    res.status(500).json({ error: "Failed to create Z report" });
  }
}

export async function getZReportHistory(req: Request, res: Response) {
  if (req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const { dateFrom, dateTo } = req.query;
  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: "dateFrom and dateTo are required" });
    return;
  }

  try {
    const fromDate = new Date(dateFrom as string);
    const toDate = new Date(dateTo as string);
    toDate.setHours(23, 59, 59, 999);

    const reports = await prisma.zReport.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      reports.map((r) => ({
        id: r.id,
        targetUserId: r.targetUserId,
        targetUserName: r.targetUserName,
        runByUserId: r.runByUserId,
        runByUserName: r.runByUserName,
        declaredCash: Number(r.declaredCash),
        declaredCard: Number(r.declaredCard),
        actualCash: Number(r.actualCash),
        actualCard: Number(r.actualCard),
        createdAt: r.createdAt,
      }))
    );
  } catch (error) {
    console.error("getZReportHistory error:", error);
    res.status(500).json({ error: "Failed to fetch Z report history" });
  }
}

export async function getZReportById(req: Request, res: Response) {
  if (req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const { id } = req.params;

  try {
    const zReport = await prisma.zReport.findUnique({ where: { id } });
    if (!zReport) {
      res.status(404).json({ error: "Z report not found" });
      return;
    }

    const transactions = (await fetchTransactionsByUserAndZReport(zReport.targetUserId, id)) as TransactionRow[];

    res.json({
      id: zReport.id,
      targetUserId: zReport.targetUserId,
      targetUserName: zReport.targetUserName,
      runByUserId: zReport.runByUserId,
      runByUserName: zReport.runByUserName,
      declaredCash: Number(zReport.declaredCash),
      declaredCard: Number(zReport.declaredCard),
      actualCash: Number(zReport.actualCash),
      actualCard: Number(zReport.actualCard),
      createdAt: zReport.createdAt,
      transactions: transactions.map(mapTransaction),
    });
  } catch (error) {
    console.error("getZReportById error:", error);
    res.status(500).json({ error: "Failed to fetch Z report" });
  }
}
