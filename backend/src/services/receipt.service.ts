import { prisma } from '../lib/prisma';

export type ReceiptLineType = 'GUARDING' | 'WASHING' | 'DELIVERY' | 'CHECKIN' | 'CHECKOUT';

export interface ReceiptLineInput {
  lineType: ReceiptLineType;
  description: string;
  amount: number;
}

export interface ReceiptResult {
  id: string;
  receiptNumber: string;
  totalAmount: number;
  discount: number | null;
  createdAt: Date;
  lines: ReceiptLineInput[];
}

export async function createReceipt(params: {
  bookingId: string;
  transactionId?: number | null;
  lines: ReceiptLineInput[];
  discountPercentage?: number | null;
}): Promise<ReceiptResult | null> {
  const { bookingId, transactionId, lines, discountPercentage } = params;
  if (lines.length === 0) return null;

  const totalAmount = parseFloat(lines.reduce((sum, l) => sum + l.amount, 0).toFixed(2));

  const result = await prisma.$transaction(async (tx) => {
    const header = await tx.receiptHeader.create({
      data: {
        bookingId,
        transactionId: transactionId != null ? BigInt(transactionId) : null,
        totalAmount,
        discount: discountPercentage ?? null,
      },
    });

    const year = header.createdAt.getFullYear();
    const receiptNumber = `REC-${year}-${String(header.receiptSeq).padStart(5, '0')}`;

    const updated = await tx.receiptHeader.update({
      where: { id: header.id },
      data: { receiptNumber },
    });

    await tx.receiptLine.createMany({
      data: lines.map((line) => ({
        receiptId: header.id,
        lineType: line.lineType,
        description: line.description,
        amount: line.amount,
      })),
    });

    return {
      id: updated.id,
      receiptNumber,
      totalAmount,
      discount: discountPercentage ?? null,
      createdAt: updated.createdAt,
      lines,
    };
  });

  return result;
}
