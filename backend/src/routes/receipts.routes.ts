import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { generateThermalReceiptPdf } from "../services/pdf.service";
import { ReceiptLineInput } from "../services/receipt.service";

const router = Router();

// No auth required — the receipt UUID (128-bit random) acts as the access token.
router.get("/thermal/:receiptId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { receiptId } = req.params;

    const receipt = await prisma.receiptHeader.findUnique({
      where: { id: receiptId },
      include: { lines: true, booking: { select: { name: true, surname: true } } },
    });

    if (!receipt) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    const lines: ReceiptLineInput[] = receipt.lines.map((l) => ({
      lineType: l.lineType as ReceiptLineInput['lineType'],
      description: l.description,
      amount: Number(l.amount),
    }));

    const pdfBuffer = await generateThermalReceiptPdf({
      receiptNumber: receipt.receiptNumber || receiptId,
      receiptDate: receipt.createdAt,
      bookingId: receipt.bookingId,
      customerName: `${receipt.booking.name} ${receipt.booking.surname}`.trim(),
      totalAmount: Number(receipt.totalAmount),
      discount: receipt.discount ?? null,
      lines,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${receipt.receiptNumber || receiptId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Error generating thermal receipt:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
