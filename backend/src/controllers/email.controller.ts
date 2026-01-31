import { Request, Response } from "express";
import { sendBookingConfirmationEmail, testEmailConnection } from "../services/email.service";

export async function sendBookingConfirmation(req: Request, res: Response) {
  try {
    const {
      email,
      fullName,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      parkingType,
      washService,
      flightNumber,
      dropOffOption,
      pickUpOption,
      finalPrice,
    } = req.body;

    if (!email || !fullName || !checkInDate || !checkInTime || !checkOutDate || !checkOutTime || !licensePlate || !vehicleBrand || !parkingType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await sendBookingConfirmationEmail({
      email,
      fullName,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      parkingType,
      washService: washService || false,
      flightNumber,
      dropOffOption,
      pickUpOption,
      finalPrice,
    });

    if (result.success) {
      return res.json({
        success: true,
        message: "Booking confirmation email sent successfully",
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("Error sending booking confirmation:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to send booking confirmation email",
    });
  }
}

export async function testEmailService(req: Request, res: Response) {
  try {
    const result = await testEmailConnection();

    if (result.success) {
      return res.json({
        success: true,
        message: "Brevo email service is connected and working",
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error("Error testing email service:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to test email service",
    });
  }
}
