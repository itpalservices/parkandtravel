import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const PAGE_SIZE = 50;

export async function getReceiptsReport(req: Request, res: Response) {
  if (req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const { dateFrom, dateTo, page: pageQuery } = req.query;
  if (!dateFrom || !dateTo) {
    res.status(400).json({ error: "dateFrom and dateTo are required" });
    return;
  }

  const page = Math.max(1, parseInt(pageQuery as string) || 1);
  const fromDate = new Date(dateFrom as string);
  const toDate = new Date(dateTo as string);
  toDate.setHours(23, 59, 59, 999);

  try {
    const [receipts, total] = await Promise.all([
      prisma.receiptHeader.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        include: {
          booking: {
            select: {
              name: true,
              surname: true,
              plateNo: true,
              carBrand: true,
              carModel: true,
              dateFrom: true,
              dateTo: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.receiptHeader.count({
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
    ]);

    res.json({
      data: receipts.map((r) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        totalAmount: Number(r.totalAmount),
        discount: r.discount,
        hasPdf: !!r.pdfKey,
        createdAt: r.createdAt,
        customerName: `${r.booking.name} ${r.booking.surname}`.trim(),
        plateNo: r.booking.plateNo,
        carBrand: r.booking.carBrand,
        carModel: r.booking.carModel,
        dateFrom: r.booking.dateFrom,
        dateTo: r.booking.dateTo,
      })),
      total,
      page,
      perPage: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
    });
  } catch (error) {
    console.error("getReceiptsReport error:", error);
    res.status(500).json({ error: "Failed to fetch receipts" });
  }
}
