import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getUserById } from "../services/auth0.service";

const PAGE_SIZE = 10;

interface EmployeeRow {
  user_id: string;
  shift_count: bigint;
}

interface TransactionRow {
  id: string;
  datetime: Date;
  amount: string;
  user_id: string;
  payment_method: string;
  notes: string | null;
  plate_no: string | null;
  type: string;
}

interface TotalsRow {
  payment_method: string;
  total: string;
  count: bigint;
}

interface CountRow {
  count: bigint;
}

export async function employeeSessionReportEmployees(_req: Request, res: Response) {
  try {
    const rows = (await prisma.$queryRaw`
      SELECT user_id, COUNT(*) AS shift_count
      FROM shifts
      GROUP BY user_id
      ORDER BY MIN(shift_start) ASC
    `) as EmployeeRow[];

    const employees = await Promise.all(
      rows.map(async (row: EmployeeRow) => {
        const user = await getUserById(row.user_id).catch(() => null);
        return {
          userId: row.user_id,
          name: user?.name || user?.email || row.user_id,
          shiftCount: Number(row.shift_count),
        };
      })
    );

    res.json(employees);
  } catch (error) {
    console.error("employeeSessionReportEmployees error:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
}

export async function employeeSessionReportShifts(req: Request, res: Response) {
  const { userId } = req.params;

  try {
    const shifts = await prisma.shift.findMany({
      where: { userId },
      orderBy: { shiftStart: "desc" },
    });
    res.json(shifts);
  } catch (error) {
    console.error("employeeSessionReportShifts error:", error);
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
}

export async function employeeSessionReportByShift(req: Request, res: Response) {
  const { shiftId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  try {
    const shiftIdNum = parseInt(shiftId);

    const [transactions, countRaw, totalsRaw] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, datetime, amount, user_id, payment_method, notes, plate_no, type
        FROM (
          SELECT ct.id, ct.datetime, ct.amount, ct.user_id, ct.payment_method, ct.notes,
                 b."plateNo" AS plate_no, 'checkout' AS type
          FROM completion_transactions ct
          LEFT JOIN bookings b ON b.id = ct.booking_id
          WHERE ct.shift_id = ${shiftIdNum}
          UNION ALL
          SELECT kit.id, kit.datetime, kit.amount, kit.user_id, kit.payment_method, kit.notes,
                 b."plateNo" AS plate_no, 'checkin' AS type
          FROM checkin_transactions kit
          LEFT JOIN bookings b ON b.id = kit.booking_id
          WHERE kit.shift_id = ${shiftIdNum}
        ) combined
        ORDER BY datetime DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `.then((r) => r as TransactionRow[]),
      prisma.$queryRaw`
        SELECT (
          SELECT COUNT(*) FROM completion_transactions WHERE shift_id = ${shiftIdNum}
        ) + (
          SELECT COUNT(*) FROM checkin_transactions WHERE shift_id = ${shiftIdNum}
        ) AS count
      `.then((r) => r as CountRow[]),
      prisma.$queryRaw`
        SELECT payment_method, SUM(amount) AS total, COUNT(*) AS count
        FROM (
          SELECT payment_method, amount FROM completion_transactions WHERE shift_id = ${shiftIdNum}
          UNION ALL
          SELECT payment_method, amount FROM checkin_transactions WHERE shift_id = ${shiftIdNum}
        ) combined
        GROUP BY payment_method
        ORDER BY payment_method
      `.then((r) => r as TotalsRow[]),
    ]);

    const total = Number(countRaw[0]?.count || 0);

    res.json({
      transactions: transactions.map((t: TransactionRow) => ({
        id: t.id,
        datetime: t.datetime,
        amount: Number(t.amount),
        userId: t.user_id,
        paymentMethod: t.payment_method,
        notes: t.notes,
        plateNo: t.plate_no,
        type: t.type,
      })),
      total,
      page,
      perPage: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      totals: totalsRaw.map((t: TotalsRow) => ({
        paymentMethod: t.payment_method,
        total: Number(t.total),
        count: Number(t.count),
      })),
    });
  } catch (error) {
    console.error("employeeSessionReportByShift error:", error);
    res.status(500).json({ error: "Failed to fetch transactions for shift" });
  }
}

export async function employeeSessionReportByDate(req: Request, res: Response) {
  const { dateFrom, dateTo } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: "dateFrom and dateTo are required" });
  }

  try {
    const fromDate = new Date(dateFrom as string);
    const toDate = new Date(dateTo as string);

    const [transactions, countRaw, totalsRaw] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, datetime, amount, user_id, payment_method, notes, plate_no, type
        FROM (
          SELECT ct.id, ct.datetime, ct.amount, ct.user_id, ct.payment_method, ct.notes,
                 b."plateNo" AS plate_no, 'checkout' AS type
          FROM completion_transactions ct
          LEFT JOIN bookings b ON b.id = ct.booking_id
          WHERE ct.datetime >= ${fromDate} AND ct.datetime <= ${toDate}
          UNION ALL
          SELECT kit.id, kit.datetime, kit.amount, kit.user_id, kit.payment_method, kit.notes,
                 b."plateNo" AS plate_no, 'checkin' AS type
          FROM checkin_transactions kit
          LEFT JOIN bookings b ON b.id = kit.booking_id
          WHERE kit.datetime >= ${fromDate} AND kit.datetime <= ${toDate}
        ) combined
        ORDER BY datetime DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `.then((r) => r as TransactionRow[]),
      prisma.$queryRaw`
        SELECT (
          SELECT COUNT(*) FROM completion_transactions
          WHERE datetime >= ${fromDate} AND datetime <= ${toDate}
        ) + (
          SELECT COUNT(*) FROM checkin_transactions
          WHERE datetime >= ${fromDate} AND datetime <= ${toDate}
        ) AS count
      `.then((r) => r as CountRow[]),
      prisma.$queryRaw`
        SELECT payment_method, SUM(amount) AS total, COUNT(*) AS count
        FROM (
          SELECT payment_method, amount FROM completion_transactions
          WHERE datetime >= ${fromDate} AND datetime <= ${toDate}
          UNION ALL
          SELECT payment_method, amount FROM checkin_transactions
          WHERE datetime >= ${fromDate} AND datetime <= ${toDate}
        ) combined
        GROUP BY payment_method
        ORDER BY payment_method
      `.then((r) => r as TotalsRow[]),
    ]);

    const total = Number(countRaw[0]?.count || 0);

    const uniqueUserIds = [...new Set(transactions.map((t: TransactionRow) => t.user_id))];
    const userMap: Record<string, string> = {};
    await Promise.all(
      uniqueUserIds.map(async (uid: string) => {
        const user = await getUserById(uid).catch(() => null);
        userMap[uid] = user?.name || user?.email || uid;
      })
    );

    res.json({
      transactions: transactions.map((t: TransactionRow) => ({
        id: t.id,
        datetime: t.datetime,
        amount: Number(t.amount),
        userId: t.user_id,
        paymentMethod: t.payment_method,
        notes: t.notes,
        plateNo: t.plate_no,
        type: t.type,
        employeeName: userMap[t.user_id] || t.user_id,
      })),
      total,
      page,
      perPage: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      totals: totalsRaw.map((t: TotalsRow) => ({
        paymentMethod: t.payment_method,
        total: Number(t.total),
        count: Number(t.count),
      })),
    });
  } catch (error) {
    console.error("employeeSessionReportByDate error:", error);
    res.status(500).json({ error: "Failed to fetch transactions by date" });
  }
}
