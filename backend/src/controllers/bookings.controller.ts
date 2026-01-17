import { Request, Response } from "express";
import {
  getBookings,
  getBookingById,
  softDeleteBooking,
  isValidDateFormat,
  isDateInPast,
  isValidUUID,
  createGuestBooking as createGuestBookingService,
  createBooking as createBookingService,
  updateBooking as updateBookingService,
} from "../services/bookings.service";
import { AuthUser } from "../middleware/auth.middleware";

export async function listBookings(req: Request, res: Response): Promise<void> {
  try {
    const { dateFrom, dateTo, search, page, limit } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;

    if (dateFrom !== undefined) {
      if (!isValidDateFormat(dateFrom as string)) {
        res.status(400).json({
          error: "dateFrom must be a valid date in YYYY-MM-DD format",
        });
        return;
      }
      // if (isDateInPast(dateFrom as string)) {
      //   res
      //     .status(400)
      //     .json({ error: "dateFrom/dateTo cannot be in the past" });
      //   return;
      // }
    }

    if (dateTo !== undefined) {
      if (!isValidDateFormat(dateTo as string)) {
        res
          .status(400)
          .json({ error: "dateTo must be a valid date in YYYY-MM-DD format" });
        return;
      }
      // if (isDateInPast(dateTo as string)) {
      //   res
      //     .status(400)
      //     .json({ error: "dateFrom/dateTo cannot be in the past" });
      //   return;
      // }
    }

    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom as string);
      const toDate = new Date(dateTo as string);
      if (fromDate > toDate) {
        res.status(400).json({ error: "dateFrom cannot be after dateTo" });
        return;
      }
    }

    const authUser = req.authUser as AuthUser | undefined;
    const isRegularUser = authUser?.role === "user";

    if (isRegularUser && !authUser?.email) {
      res.status(403).json({ error: "Email claim required for user access" });
      return;
    }

    const userId = isRegularUser ? authUser?.sub : undefined;

    const result = await getBookings({
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      search: search as string | undefined,
      page: pageNum,
      limit: limitNum,
      userId,
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

    const authUser = req.authUser as AuthUser | undefined;
    const isRegularUser = authUser?.role === "user";

    if (isRegularUser) {
      if (!authUser?.email) {
        res.status(403).json({ error: "Email claim required for user access" });
        return;
      }
      if (booking.email?.toLowerCase() !== authUser.email.toLowerCase()) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    res.json(booking);
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteBooking(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }

    const authUser = req.authUser as AuthUser | undefined;
    const isRegularUser = authUser?.role === "user";

    if (isRegularUser) {
      if (!authUser?.email) {
        res.status(403).json({ error: "Email claim required for user access" });
        return;
      }
      const booking = await getBookingById(id);
      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }
      if (booking.email?.toLowerCase() !== authUser.email.toLowerCase()) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
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

export async function createGuestBooking(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      fullName,
      email,
      phone,
      phoneCodeId,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      flightNumber,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      parkingTypeId,
      washService,
      dropOffOption,
      pickUpOption,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !licensePlate ||
      !vehicleModel ||
      !checkInDate ||
      !checkInTime ||
      !checkOutDate ||
      !checkOutTime ||
      !parkingTypeId ||
      !vehicleColor ||
      !vehicleBrand ||
      !dropOffOption ||
      !pickUpOption
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await createGuestBookingService({
      fullName,
      email,
      phone,
      phoneCodeId: phoneCodeId || null,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      flightNumber,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      parkingTypeId,
      washService: washService === true,
      dropOffOption: dropOffOption || null,
      pickUpOption: pickUpOption || null,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error creating guest booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createBooking(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      fullName,
      email,
      phone,
      phoneCodeId,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      flightNumber,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      parkingTypeId,
      washService,
      dropOffOption,
      pickUpOption,
      userId: requestUserId,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !licensePlate ||
      !vehicleModel ||
      !checkInDate ||
      !checkInTime ||
      !checkOutDate ||
      !checkOutTime ||
      !parkingTypeId ||
      !vehicleColor ||
      !vehicleBrand ||
      !dropOffOption ||
      !pickUpOption
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const authUser = req.authUser as AuthUser | undefined;
    const isAdminOrDriver = authUser?.role === "admin" || authUser?.role === "driver";
    
    let userId: string | null;
    if (isAdminOrDriver) {
      userId = requestUserId !== undefined ? requestUserId : null;
    } else {
      userId = authUser?.sub || null;
    }

    const result = await createBookingService({
      fullName,
      email,
      phone,
      phoneCodeId: phoneCodeId || null,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      flightNumber,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      parkingTypeId,
      washService: washService === true,
      dropOffOption: dropOffOption || null,
      pickUpOption: pickUpOption || null,
      userId,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateBooking(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }

    const {
      fullName,
      email,
      phone,
      phoneCodeId,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      flightNumber,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      parkingTypeId,
      washService,
      dropOffOption,
      pickUpOption,
      userId: requestUserId,
    } = req.body;

    if (checkInDate && !isValidDateFormat(checkInDate)) {
      res.status(400).json({
        error: "checkInDate must be a valid date in YYYY-MM-DD format",
      });
      return;
    }

    if (checkOutDate && !isValidDateFormat(checkOutDate)) {
      res.status(400).json({
        error: "checkOutDate must be a valid date in YYYY-MM-DD format",
      });
      return;
    }

    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      if (checkIn >= checkOut) {
        res
          .status(400)
          .json({ error: "Check-out date must be after check-in date" });
        return;
      }
    }

    const authUser = req.authUser as AuthUser | undefined;
    const isAdminOrDriver = authUser?.role === "admin" || authUser?.role === "driver";

    let userId: string | null | undefined;
    if (isAdminOrDriver && requestUserId !== undefined) {
      userId = requestUserId;
    }

    const result = await updateBookingService(id, {
      fullName,
      email,
      phone,
      phoneCodeId: phoneCodeId ?? undefined,
      licensePlate,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      flightNumber,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      parkingTypeId,
      washService,
      dropOffOption,
      pickUpOption,
      userId,
    });

    if (!result) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
