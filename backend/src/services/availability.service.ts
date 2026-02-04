import { prisma } from "../lib/prisma";
import { getSettings } from "./settings.service";

interface AvailabilityResult {
  available: boolean;
  unavailableDates: string[];
  message?: string;
  availableSpots?: number;
  totalSpots?: number;
}

interface DailyAvailability {
  date: string;
  bookedCount: number;
  totalSpots: number;
  available: boolean;
}

function normalizeParkingType(parkingTypeId: string): "covered" | "uncovered" {
  if (parkingTypeId === "covered" || parkingTypeId === "parkingType_covered") {
    return "covered";
  }
  return "uncovered";
}

function getParkingTypeDisplayName(parkingTypeId: string): string {
  const normalizedType = normalizeParkingType(parkingTypeId);
  return normalizedType === "covered" ? "Covered" : "Un Covered";
}

function formatDateDDMMYYYY(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export async function checkAvailability(
  dateFrom: string,
  dateTo: string,
  parkingTypeId: string,
  excludeBookingId?: string
): Promise<AvailabilityResult> {
  const settings = await getSettings();
  const normalizedType = normalizeParkingType(parkingTypeId);

  const totalSpots =
    normalizedType === "covered"
      ? settings.availableCovered
      : settings.availableUncovered;

  if (totalSpots === null || totalSpots === 0) {
    return {
      available: false,
      unavailableDates: [],
      message: `${getParkingTypeDisplayName(parkingTypeId)} parking is not available`,
      totalSpots: 0,
    };
  }

  const dates = getDateRange(dateFrom, dateTo);
  const dailyAvailability = await getDailyBookingCounts(
    dates,
    parkingTypeId,
    totalSpots,
    excludeBookingId
  );

  const unavailableDates = dailyAvailability
    .filter((d) => !d.available)
    .map((d) => d.date);

  if (unavailableDates.length > 0) {
    const formattedDates = unavailableDates.map(formatDateDDMMYYYY);
    return {
      available: false,
      unavailableDates,
      message: `No ${getParkingTypeDisplayName(parkingTypeId)} parking spots available for: ${formattedDates.join(", ")}`,
      totalSpots,
    };
  }

  const minAvailable = Math.min(
    ...dailyAvailability.map((d) => d.totalSpots - d.bookedCount)
  );

  return {
    available: true,
    unavailableDates: [],
    availableSpots: minAvailable,
    totalSpots,
  };
}

function getDateRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  const current = new Date(start);
  while (current < end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

async function getDailyBookingCounts(
  dates: string[],
  parkingTypeId: string,
  totalSpots: number,
  excludeBookingId?: string
): Promise<DailyAvailability[]> {
  if (dates.length === 0) {
    return [];
  }

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  let query = `SELECT "dateFrom", "dateTo" FROM bookings 
     WHERE "parkingTypeId" = $1 
     AND "deleteflag" = 0 
     AND "dateFrom" <= $2::date 
     AND "dateTo" > $3::date`;
  
  const queryParams: any[] = [parkingTypeId, lastDate, firstDate];
  
  if (excludeBookingId) {
    query += ` AND id != $4`;
    queryParams.push(excludeBookingId);
  }

  const bookings = await prisma.$queryRawUnsafe<
    { dateFrom: Date; dateTo: Date }[]
  >(query, ...queryParams);

  return dates.map((date) => {
    const dateObj = new Date(date);
    const bookedCount = bookings.filter((booking) => {
      const bookingStart = new Date(booking.dateFrom);
      const bookingEnd = new Date(booking.dateTo);
      return dateObj >= bookingStart && dateObj <= bookingEnd;
    }).length;

    return {
      date,
      bookedCount,
      totalSpots,
      available: bookedCount < totalSpots,
    };
  });
}

export async function getAvailabilityForDateRange(
  dateFrom: string,
  dateTo: string
): Promise<{
  covered: AvailabilityResult;
  uncovered: AvailabilityResult;
}> {
  const [covered, uncovered] = await Promise.all([
    checkAvailability(dateFrom, dateTo, "covered"),
    checkAvailability(dateFrom, dateTo, "uncovered"),
  ]);

  return { covered, uncovered };
}
