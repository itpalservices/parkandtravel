import { Request, Response } from "express";
import { getDashboardStats, getCheckIns, getCheckOuts, getCardDetails } from "../services/dashboard.service";

export async function getDashboardStatsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
}

export async function getCheckInsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ error: "dateFrom and dateTo are required" });
      return;
    }
    const checkIns = await getCheckIns(dateFrom as string, dateTo as string);
    res.json(checkIns);
  } catch (error) {
    console.error("Error fetching check-ins:", error);
    res.status(500).json({ error: "Failed to fetch check-ins" });
  }
}

export async function getCheckOutsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ error: "dateFrom and dateTo are required" });
      return;
    }
    const checkOuts = await getCheckOuts(dateFrom as string, dateTo as string);
    res.json(checkOuts);
  } catch (error) {
    console.error("Error fetching check-outs:", error);
    res.status(500).json({ error: "Failed to fetch check-outs" });
  }
}

export async function getCardDetailsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { cardType } = req.query;
    if (!cardType) {
      res.status(400).json({ error: "cardType is required" });
      return;
    }
    const details = await getCardDetails(cardType as string);
    res.json(details);
  } catch (error) {
    console.error("Error fetching card details:", error);
    res.status(500).json({ error: "Failed to fetch card details" });
  }
}
