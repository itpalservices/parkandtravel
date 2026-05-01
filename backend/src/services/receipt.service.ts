import { prisma } from '../lib/prisma';

export type ReceiptLineType = 'GUARDING' | 'WASHING' | 'DELIVERY';

export interface ReceiptLineInput {
  lineType: ReceiptLineType;
  description: string;
  amount: number;
}

export async function createReceipt(params: {
  bookingId: string;
  transactionId: number;
  lines: ReceiptLineInput[];
  discountPercentage?: number | null;
}): Promise<void> {
  const { bookingId, transactionId, lines, discountPercentage } = params;
  if (lines.length === 0) return;

  const totalAmount = parseFloat(lines.reduce((sum, l) => sum + l.amount, 0).toFixed(2));

  await prisma.$transaction(async (tx) => {
    const header = await tx.receiptHeader.create({
      data: {
        bookingId,
        transactionId: BigInt(transactionId),
        totalAmount,
        discount: discountPercentage ?? null,
      },
    });

    const year = header.createdAt.getFullYear();
    const receiptNumber = `REC-${year}-${String(header.receiptSeq).padStart(5, '0')}`;

    await tx.receiptHeader.update({
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
  });
}
