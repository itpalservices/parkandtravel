import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getAllEmployees, getUserById } from "../services/auth0.service";

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

export async function getXReport(req: Request, res: Response) {
  const userId = req.authUser?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [transactions, totalsRaw] = await Promise.all([
      fetchTransactionsByUserAndZReport(userId, null),
      prisma.$queryRaw`
        SELECT payment_method, SUM(amount) AS total
        FROM (
          SELECT payment_method, amount FROM completion_transactions
          WHERE user_id = ${userId} AND z_report_id IS NULL
          UNION ALL
          SELECT payment_method, amount FROM checkin_transactions
          WHERE user_id = ${userId} AND z_report_id IS NULL
        ) combined
        GROUP BY payment_method
      ` as Promise<TotalsRow[]>,
    ]);

    const totals: Record<string, number> = {};
    (totalsRaw as TotalsRow[]).forEach((t) => {
      totals[t.payment_method] = Number(t.total);
    });

    res.json({
      transactions: (transactions as TransactionRow[]).map(mapTransaction),
      totals,
    });
  } catch (error) {
    console.error("getXReport error:", error);
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
