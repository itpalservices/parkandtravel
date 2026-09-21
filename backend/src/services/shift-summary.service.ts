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
