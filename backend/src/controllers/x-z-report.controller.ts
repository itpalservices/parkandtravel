import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getAllEmployees } from "../services/auth0.service";
import {
  getOpenShiftForUser,
  getOpenShiftTransactions,
  getOpenShiftTotals,
  resolveEmployeeName,
  summarizeTotals,
  mergeTotals,
  EmployeeLookup,
  OpenShiftTransaction,
  OpenShiftTotal,
} from "../services/shift-summary.service";

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
  const employeeMap = new Map<string, EmployeeLookup>(employeeList.map((e) => [e.userId, e]));

  const employees: OpenShiftEmployeeSummary[] = await Promise.all(
    openShifts.map(async (shift) => {
      const [transactions, totals] = await Promise.all([
        getOpenShiftTransactions(shift.id),
        getOpenShiftTotals(shift.id),
      ]);

      return {
        userId: shift.userId,
        employeeName: resolveEmployeeName(shift.userId, employeeMap),
        shiftId: shift.id,
        shiftStart: shift.shiftStart,
        transactions,
        totals,
        employeeTotal: totals.reduce((sum, t) => sum + t.total, 0),
      };
    })
  );

  const { grandTotal, grandTotals } = mergeTotals(employees.map((e) => e.totals));

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

// ===================== Z REPORT =====================
// A Z-report is a global sweep, not a per-employee action: it closes out every checkin/completion
// transaction whose shift is CLOSED and not yet reported, across every employee at once. Open
// shifts are left completely untouched — they only become eligible once that employee closes out
// (which itself requires a successful printed proof, per the shift-close flow). There's no
// declared/actual reconciliation anymore; that already happens per-shift at close time.

interface ZReportSweepRow {
  id: string;
  datetime: Date;
  amount: string;
  payment_method: string;
  notes: string | null;
  plate_no: string | null;
  booking_reference: string | null;
  user_id: string;
}

export interface ZReportEmployeeSummary {
  userId: string;
  employeeName: string;
  transactions: OpenShiftTransaction[];
  totals: OpenShiftTotal[];
  employeeTotal: number;
  employeeNet: number;
  employeeVat: number;
}

export interface ZReportResult {
  id: string;
  runByUserId: string;
  runByUserName: string;
  createdAt: Date;
  vatRate: number;
  employees: ZReportEmployeeSummary[];
  grandTotal: number;
  grandNet: number;
  grandVat: number;
  grandTotals: OpenShiftTotal[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Amounts are VAT-inclusive — same split as the receipts in pdf.service. */
function splitVat(gross: number, vatRate: number): { net: number; vat: number } {
  const net = round2(gross / (1 + vatRate / 100));
  return { net, vat: round2(gross - net) };
}

/** The VAT rate currently configured — snapshotted onto each Z-report at creation time. */
async function getCurrentVatRate(tx: Pick<typeof prisma, "configurationSetting">): Promise<number> {
  const setting = await tx.configurationSetting.findUnique({ where: { id: "configurationSetting_tax" } });
  const rate = parseFloat(setting?.value ?? "");
  return Number.isFinite(rate) ? rate : 0;
}

/** Builds the full response from a report row + its tagged transactions. Net/VAT use the report's
 *  own stored rate; the grand Net/VAT are the sum of the employees' so the report always adds up. */
async function buildZReportResult(
  report: { id: string; runByUserId: string; runByUserName: string; createdAt: Date; vatRate: unknown },
  rows: ZReportSweepRow[]
): Promise<ZReportResult> {
  const vatRate = Number(report.vatRate);
  const employees = (await buildZReportEmployeeSummaries(rows)).map((e) => {
    const { net, vat } = splitVat(e.employeeTotal, vatRate);
    return { ...e, employeeNet: net, employeeVat: vat };
  });
  const { grandTotal, grandTotals } = mergeTotals(employees.map((e) => e.totals));

  return {
    id: report.id,
    runByUserId: report.runByUserId,
    runByUserName: report.runByUserName,
    createdAt: report.createdAt,
    vatRate,
    employees,
    grandTotal,
    grandNet: round2(employees.reduce((sum, e) => sum + e.employeeNet, 0)),
    grandVat: round2(employees.reduce((sum, e) => sum + e.employeeVat, 0)),
    grandTotals,
  };
}

/** Groups a flat list of rows (already tagged with a single z_report_id, whether just-swept or
 *  historical) into one summary section per employee, sorted alphabetically by name. */
async function buildZReportEmployeeSummaries(
  rows: ZReportSweepRow[]
): Promise<Omit<ZReportEmployeeSummary, "employeeNet" | "employeeVat">[]> {
  if (rows.length === 0) return [];

  const employeeList = await getAllEmployees().catch(() => []);
  const employeeMap = new Map<string, EmployeeLookup>(employeeList.map((e) => [e.userId, e]));

  const byUser = new Map<string, ZReportSweepRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const employees = Array.from(byUser.entries()).map(([userId, userRows]) => {
    const transactions: OpenShiftTransaction[] = userRows
      .map((r) => ({
        id: r.id,
        datetime: r.datetime,
        amount: Number(r.amount),
        paymentMethod: r.payment_method,
        notes: r.notes,
        plateNo: r.plate_no,
        bookingReference: r.booking_reference,
        type: ((r as any).type) as "checkin" | "checkout",
      }))
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

    const totals = summarizeTotals(transactions.map((t) => ({ paymentMethod: t.paymentMethod, amount: t.amount })));

    return {
      userId,
      employeeName: resolveEmployeeName(userId, employeeMap),
      transactions,
      totals,
      employeeTotal: totals.reduce((sum, t) => sum + t.total, 0),
    };
  });

  employees.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  return employees;
}

export async function createZReport(req: Request, res: Response) {
  const adminId = req.authUser?.sub;
  const adminEmail = req.authUser?.email;
  if (!adminId || req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  try {
    const adminName = adminEmail || adminId;

    const zReport = await prisma.$transaction(async (tx) => {
      const vatRate = await getCurrentVatRate(tx);
      const report = await tx.zReport.create({
        data: { runByUserId: adminId, runByUserName: adminName, vatRate },
      });

      const [completionRows, checkinRows] = await Promise.all([
        tx.$queryRaw`
          WITH updated AS (
            UPDATE completion_transactions ct
            SET z_report_id = ${report.id}::uuid
            FROM shifts s
            WHERE s.id = ct.shift_id AND s.status = 'closed' AND ct.z_report_id IS NULL
              AND NOT (ct.payment_method = 'online' AND ct.amount = 0)
            RETURNING ct.id, ct.datetime, ct.amount, ct.payment_method, ct.notes, ct.user_id, ct.booking_id
          )
          SELECT u.id, u.datetime, u.amount, u.payment_method, u.notes, u.user_id,
                 b."plateNo" AS plate_no, b.booking_reference AS booking_reference, 'checkout' AS type
          FROM updated u
          LEFT JOIN bookings b ON b.id = u.booking_id
        ` as Promise<(ZReportSweepRow & { type: string })[]>,
        tx.$queryRaw`
          WITH updated AS (
            UPDATE checkin_transactions kit
            SET z_report_id = ${report.id}::uuid
            FROM shifts s
            WHERE s.id = kit.shift_id AND s.status = 'closed' AND kit.z_report_id IS NULL
            RETURNING kit.id, kit.datetime, kit.amount, kit.payment_method, kit.notes, kit.user_id, kit.booking_id
          )
          SELECT u.id, u.datetime, u.amount, u.payment_method, u.notes, u.user_id,
                 b."plateNo" AS plate_no, b.booking_reference AS booking_reference, 'checkin' AS type
          FROM updated u
          LEFT JOIN bookings b ON b.id = u.booking_id
        ` as Promise<(ZReportSweepRow & { type: string })[]>,
      ]);

      const rows = [...completionRows, ...checkinRows];
      if (rows.length === 0) {
        throw new Error("NOTHING_TO_REPORT");
      }

      return { report, rows };
    });

    const result = await buildZReportResult(zReport.report, zReport.rows as any);
    res.status(201).json(result);
  } catch (error: any) {
    if (error?.message === "NOTHING_TO_REPORT") {
      res.status(400).json({ error: "No unreported transactions from closed shifts were found." });
      return;
    }
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

    if (reports.length === 0) {
      res.json([]);
      return;
    }

    const ids = reports.map((r) => r.id);
    const aggregateRows = await prisma.$queryRaw`
      SELECT z_report_id, COUNT(DISTINCT user_id) AS employee_count, COUNT(*) AS transaction_count, SUM(amount) AS grand_total
      FROM (
        SELECT z_report_id, user_id, amount FROM completion_transactions WHERE z_report_id = ANY(${ids}::uuid[])
        UNION ALL
        SELECT z_report_id, user_id, amount FROM checkin_transactions WHERE z_report_id = ANY(${ids}::uuid[])
      ) combined
      GROUP BY z_report_id
    ` as { z_report_id: string; employee_count: bigint; transaction_count: bigint; grand_total: string }[];

    const aggregateMap = new Map(aggregateRows.map((a) => [a.z_report_id, a]));

    res.json(
      reports.map((r) => {
        const agg = aggregateMap.get(r.id);
        return {
          id: r.id,
          runByUserId: r.runByUserId,
          runByUserName: r.runByUserName,
          createdAt: r.createdAt,
          employeeCount: agg ? Number(agg.employee_count) : 0,
          transactionCount: agg ? Number(agg.transaction_count) : 0,
          grandTotal: agg ? Number(agg.grand_total) : 0,
        };
      })
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

    const [completionRows, checkinRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT ct.id, ct.datetime, ct.amount, ct.payment_method, ct.notes, ct.user_id,
               b."plateNo" AS plate_no, b.booking_reference AS booking_reference, 'checkout' AS type
        FROM completion_transactions ct
        LEFT JOIN bookings b ON b.id = ct.booking_id
        WHERE ct.z_report_id = ${id}::uuid
      ` as Promise<(ZReportSweepRow & { type: string })[]>,
      prisma.$queryRaw`
        SELECT kit.id, kit.datetime, kit.amount, kit.payment_method, kit.notes, kit.user_id,
               b."plateNo" AS plate_no, b.booking_reference AS booking_reference, 'checkin' AS type
        FROM checkin_transactions kit
        LEFT JOIN bookings b ON b.id = kit.booking_id
        WHERE kit.z_report_id = ${id}::uuid
      ` as Promise<(ZReportSweepRow & { type: string })[]>,
    ]);

    const result = await buildZReportResult(zReport, [...completionRows, ...checkinRows] as any);
    res.json(result);
  } catch (error) {
    console.error("getZReportById error:", error);
    res.status(500).json({ error: "Failed to fetch Z report" });
  }
}
