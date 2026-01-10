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

function isValidNonNegativeInteger(value: any): boolean {
  if (value === null || value === undefined) return true;
  const num = Number(value);
  return Number.isInteger(num) && num >= 0;
}

function isValidNonNegativeNumber(value: any): boolean {
  if (value === null || value === undefined) return true;
  const num = Number(value);
  return !isNaN(num) && num >= 0;
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

    if (!isValidNonNegativeInteger(availableUncovered)) {
      res.status(400).json({
        error: "Available uncovered spaces must be a non-negative integer",
      });
      return;
    }

    if (!isValidNonNegativeInteger(availableCovered)) {
      res.status(400).json({
        error: "Available covered spaces must be a non-negative integer",
      });
      return;
    }

    if (!isValidNonNegativeNumber(data.priceUncovered)) {
      res.status(400).json({
        error: "Price uncovered must be a non-negative number",
      });
      return;
    }

    if (!isValidNonNegativeNumber(data.priceCovered)) {
      res.status(400).json({
        error: "Price covered must be a non-negative number",
      });
      return;
    }

    if (!isValidNonNegativeNumber(data.priceWash)) {
      res.status(400).json({
        error: "Price wash must be a non-negative number",
      });
      return;
    }

    const validatedData: Partial<ConfigurationSettings> = {
      availableUncovered: availableUncovered !== null && availableUncovered !== undefined
        ? Math.floor(Number(availableUncovered))
        : null,
      availableCovered: availableCovered !== null && availableCovered !== undefined
        ? Math.floor(Number(availableCovered))
        : null,
      priceUncovered: null,
      priceCovered: null,
      priceWash: data.priceWash !== null && data.priceWash !== undefined
        ? Number(data.priceWash)
        : null,
    };

    if (validatedData.availableUncovered && validatedData.availableUncovered > 0) {
      validatedData.priceUncovered = data.priceUncovered !== null && data.priceUncovered !== undefined
        ? Number(data.priceUncovered)
        : null;
    }

    if (validatedData.availableCovered && validatedData.availableCovered > 0) {
      validatedData.priceCovered = data.priceCovered !== null && data.priceCovered !== undefined
        ? Number(data.priceCovered)
        : null;
    }

    const settings = await updateSettings(validatedData);
    res.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
