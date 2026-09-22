import { prisma } from "../lib/prisma";

export interface OpenShiftTransaction {
  id: string;
  datetime: Date;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  plateNo: string | null;
  bookingReference: string | null;
  type: "checkin" | "checkout";
}

export interface OpenShiftTotal {
  paymentMethod: string;
  total: number;
  count: number;
}

interface TransactionRow {
  id: string;
  datetime: Date;
  amount: string;
  payment_method: string;
  notes: string | null;
  plate_no: string | null;
  booking_reference: string | null;
  type: string;
}

interface TotalsRow {
  payment_method: string;
  total: string;
  count: bigint;
}

/** The single currently-open shift for a user, if any — there's never more than one, since
 *  starting a shift always reuses whatever's already open. */
export async function getOpenShiftForUser(userId: string): Promise<{ id: number; shiftStart: Date } | null> {
  return prisma.shift.findFirst({
    where: { userId, status: "open" },
    select: { id: true, shiftStart: true },
  });
}

export async function getOpenShiftTransactions(shiftId: number): Promise<OpenShiftTransaction[]> {
  const rows = await prisma.$queryRaw`
    SELECT id, datetime, amount, payment_method, notes, plate_no, booking_reference, type
    FROM (
      SELECT ct.id, ct.datetime, ct.amount, ct.payment_method, ct.notes,
             b."plateNo" AS plate_no, b.booking_reference AS booking_reference, 'checkout' AS type
      FROM completion_transactions ct
      LEFT JOIN bookings b ON b.id = ct.booking_id
      WHERE ct.shift_id = ${shiftId}
        AND NOT (ct.payment_method = 'online' AND ct.amount = 0)
      UNION ALL
      SELECT kit.id, kit.datetime, kit.amount, kit.payment_method, kit.notes,
             b."plateNo" AS plate_no, b.booking_reference AS booking_reference, 'checkin' AS type
      FROM checkin_transactions kit
      LEFT JOIN bookings b ON b.id = kit.booking_id
      WHERE kit.shift_id = ${shiftId}
    ) combined
    ORDER BY datetime DESC
  `.then((r) => r as TransactionRow[]);

  return rows.map((t) => ({
    id: t.id,
    datetime: t.datetime,
    amount: Number(t.amount),
    paymentMethod: t.payment_method,
    notes: t.notes,
    plateNo: t.plate_no,
    bookingReference: t.booking_reference,
    type: t.type as "checkin" | "checkout",
  }));
}

/** Same exclusion rule as the transaction list above (hide the zero-amount 'online'
 *  no-payment-required marker; discount/complimentary/fee_waived/refund pairs are shown in full). */
export async function getOpenShiftTotals(shiftId: number): Promise<OpenShiftTotal[]> {
  const totalsRaw = await prisma.$queryRaw`
    SELECT payment_method, SUM(amount) AS total, COUNT(*) AS count
    FROM (
      SELECT payment_method, amount FROM completion_transactions
      WHERE shift_id = ${shiftId}
        AND NOT (payment_method = 'online' AND amount = 0)
      UNION ALL
      SELECT payment_method, amount FROM checkin_transactions
      WHERE shift_id = ${shiftId}
    ) combined
    GROUP BY payment_method
    ORDER BY payment_method
  `.then((r) => r as TotalsRow[]);

  return totalsRaw.map((t) => ({
    paymentMethod: t.payment_method,
    total: Number(t.total),
    count: Number(t.count),
  }));
}

export interface EmployeeLookup {
  userId: string;
  name: string;
  surname: string;
}

export function resolveEmployeeName(userId: string, employeeMap: Map<string, EmployeeLookup>): string {
  const employee = employeeMap.get(userId);
  if (!employee) return userId;
  return `${employee.name} ${employee.surname}`.trim() || userId;
}

/** Derives a payment-method breakdown from a flat list of transactions — used wherever totals
 *  aren't already computed by a GROUP BY query (e.g. a Z-report sweep's per-employee totals,
 *  built from rows already fetched for the transaction list). */
export function summarizeTotals(rows: { paymentMethod: string; amount: number }[]): OpenShiftTotal[] {
  const byMethod = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const existing = byMethod.get(row.paymentMethod) ?? { total: 0, count: 0 };
    existing.total += row.amount;
    existing.count += 1;
    byMethod.set(row.paymentMethod, existing);
  }
  return Array.from(byMethod.entries())
    .map(([paymentMethod, v]) => ({ paymentMethod, total: v.total, count: v.count }))
    .sort((a, b) => a.paymentMethod.localeCompare(b.paymentMethod));
}

/** Merges several employees' own totals breakdowns into one combined payment-method breakdown
 *  plus a single grand total — used for both the admin X-Report and Z-Report sweeps. */
export function mergeTotals(totalsPerEmployee: OpenShiftTotal[][]): { grandTotal: number; grandTotals: OpenShiftTotal[] } {
  const byMethod = new Map<string, { total: number; count: number }>();
  for (const totals of totalsPerEmployee) {
    for (const t of totals) {
      const existing = byMethod.get(t.paymentMethod) ?? { total: 0, count: 0 };
      existing.total += t.total;
      existing.count += t.count;
      byMethod.set(t.paymentMethod, existing);
    }
  }
  const grandTotals = Array.from(byMethod.entries())
    .map(([paymentMethod, v]) => ({ paymentMethod, total: v.total, count: v.count }))
    .sort((a, b) => a.paymentMethod.localeCompare(b.paymentMethod));
  const grandTotal = grandTotals.reduce((sum, t) => sum + t.total, 0);
  return { grandTotal, grandTotals };
}
