import { Request, Response } from "express";
import {
  checkAvailability,
  getAvailabilityForDateRange,
} from "../services/availability.service";

export async function checkParkingAvailability(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { dateFrom, dateTo, parkingTypeId } = req.query;

    if (!dateFrom || !dateTo || !parkingTypeId) {
      res.status(400).json({
        error: "dateFrom, dateTo, and parkingTypeId are required",
      });
      return;
    }

    const result = await checkAvailability(
      dateFrom as string,
      dateTo as string,
      parkingTypeId as string
    );

    res.json(result);
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({ error: "Failed to check availability" });
  }
}

export async function getAvailabilityBoth(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
      res.status(400).json({
        error: "dateFrom and dateTo are required",
      });
      return;
    }

    const result = await getAvailabilityForDateRange(
      dateFrom as string,
      dateTo as string
    );

    res.json(result);
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({ error: "Failed to check availability" });
  }
}
