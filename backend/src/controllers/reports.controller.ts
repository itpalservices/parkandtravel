import { Request, Response } from "express";
import { getWashServiceReport } from "../services/reports.service";

export async function washServiceReport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { date } = req.query;

    if (!date || typeof date !== "string") {
      res.status(400).json({ error: "Date parameter is required" });
      return;
    }

    const report = await getWashServiceReport(date);
    res.json(report);
  } catch (error) {
    console.error("Error fetching wash service report:", error);
    res.status(500).json({ error: "Failed to fetch wash service report" });
  }
}
