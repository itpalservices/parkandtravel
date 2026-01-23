import { Request, Response } from "express";
import { validateFlightNumber } from "../services/flight.service";

export async function validateFlight(req: Request, res: Response) {
  try {
    const { flightNumber } = req.query;

    if (!flightNumber || typeof flightNumber !== 'string') {
      res.status(400).json({ error: "Flight number is required" });
      return;
    }

    const result = await validateFlightNumber(flightNumber);

    if (result.valid) {
      res.json({
        success: true,
        data: {
          flightNumber: result.flightNumber,
          airline: result.airline,
          departure: result.departure,
          arrival: result.arrival,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'Flight not found',
      });
    }
  } catch (error) {
    console.error("Error validating flight:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
