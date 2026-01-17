import { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboard.service";

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
