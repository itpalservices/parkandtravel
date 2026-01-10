import { Request, Response } from "express";
import {
  getSettings,
  updateSettings,
  ConfigurationSettings,
} from "../services/settings.service";
import { AuthUser } from "../middleware/auth.middleware";

export async function getSettingsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser as AuthUser | undefined;

    if (authUser?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error getting settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateSettingsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser as AuthUser | undefined;

    if (authUser?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const data: Partial<ConfigurationSettings> = req.body;

    const availableUncovered = data.availableUncovered;
    const availableCovered = data.availableCovered;

    if (
      (availableUncovered === null || availableUncovered === undefined) &&
      (availableCovered === null || availableCovered === undefined)
    ) {
      res.status(400).json({
        error:
          "At least one of available uncovered or available covered must be provided",
      });
      return;
    }

    if (data.priceCovered !== null && data.priceCovered !== undefined) {
      if (!availableCovered || availableCovered <= 0) {
        res.status(400).json({
          error:
            "Price for covered parking requires available covered places > 0",
        });
        return;
      }
    }

    if (data.priceUncovered !== null && data.priceUncovered !== undefined) {
      if (!availableUncovered || availableUncovered <= 0) {
        res.status(400).json({
          error:
            "Price for uncovered parking requires available uncovered places > 0",
        });
        return;
      }
    }

    const settings = await updateSettings(data);
    res.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
