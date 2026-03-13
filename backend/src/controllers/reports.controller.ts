import { Request, Response } from "express";
import { getWashServiceReport, getDailyInOutReport } from "../services/reports.service";
import { getWalleeTransactions } from "../services/wallee.service";

export async function dailyInOutReport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { date, filterBy } = req.query;

    if (!date || typeof date !== "string") {
      res.status(400).json({ error: "Date parameter is required" });
      return;
    }

    const filterByValue = (filterBy as string) || "both";
    const report = await getDailyInOutReport(date, filterByValue);
    res.json(report);
  } catch (error) {
    console.error("Error fetching daily in/out report:", error);
    res.status(500).json({ error: "Failed to fetch daily in/out report" });
  }
}

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

export async function zReport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { dateFrom, dateTo, offset } = req.query;

    if (!dateFrom || typeof dateFrom !== "string") {
      res.status(400).json({ error: "dateFrom parameter is required" });
      return;
    }

    if (!dateTo || typeof dateTo !== "string") {
      res.status(400).json({ error: "dateTo parameter is required" });
      return;
    }

    const offsetValue = offset ? parseInt(offset as string, 10) : 0;

    const data = await getWalleeTransactions(dateFrom, dateTo, offsetValue);
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching z-report from Wallee:", error?.response?.data || error?.message || error);
    res.status(500).json({ error: "Failed to fetch z-report" });
  }
}
