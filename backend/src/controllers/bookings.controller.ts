import { Request, Response } from "express";
import {
  getBookings,
  getBookingById,
  softDeleteBooking,
  isValidDateFormat,
  isDateInPast,
  isValidUUID,
} from "../services/bookings.service";

export async function listBookings(req: Request, res: Response): Promise<void> {
  try {
    const { dateFrom, dateTo, search, page, limit } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;

    if (dateFrom !== undefined) {
      if (!isValidDateFormat(dateFrom as string)) {
        res.status(400).json({ error: "dateFrom must be a valid date in YYYY-MM-DD format" });
        return;
      }
      if (isDateInPast(dateFrom as string)) {
        res.status(400).json({ error: "dateFrom/dateTo cannot be in the past" });
        return;
      }
    }

    if (dateTo !== undefined) {
      if (!isValidDateFormat(dateTo as string)) {
        res.status(400).json({ error: "dateTo must be a valid date in YYYY-MM-DD format" });
        return;
      }
      if (isDateInPast(dateTo as string)) {
        res.status(400).json({ error: "dateFrom/dateTo cannot be in the past" });
        return;
      }
    }

    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom as string);
      const toDate = new Date(dateTo as string);
      if (fromDate > toDate) {
        res.status(400).json({ error: "dateFrom cannot be after dateTo" });
        return;
      }
    }

    const result = await getBookings({
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      search: search as string | undefined,
      page: pageNum,
      limit: limitNum,
    });

    res.json(result);
  } catch (error) {
    console.error("Error listing bookings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getBooking(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }

    const booking = await getBookingById(id);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    res.json(booking);
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteBooking(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }

    const result = await softDeleteBooking(id);

    if (!result) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
