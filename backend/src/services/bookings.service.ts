import { prisma } from "../lib/prisma";

interface GetBookingsParams {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page: number;
  limit: number;
}

interface BookingResponse {
  id: string;
  name: string;
  surname: string;
  email: string | null;
  returnFlight: string | null;
  dateFrom: string;
  timeFrom: string | null;
  dateTo: string;
  timeTo: string | null;
  mobile: string | null;
  plateNo: string | null;
  carBrand: string | null;
  carModel: string | null;
  carColor: string | null;
  parkingType: string | null;
  adults: number | null;
  deleteflag: number;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatTime(time: Date | null): string | null {
  if (!time) return null;
  return time.toISOString().split("T")[1].substring(0, 8);
}

function isValidDateFormat(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isDateInPast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inputDate = new Date(dateStr);
  inputDate.setHours(0, 0, 0, 0);
  return inputDate < today;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function getBookings(params: GetBookingsParams): Promise<{
  data: BookingResponse[];
  meta: { total: number; page: number; limit: number };
}> {
  const { dateFrom, dateTo, search, page, limit } = params;

  const now = new Date();
  const nowTime = now.toTimeString().split(" ")[0];
  const nowDate = formatDate(now);

  const whereConditions: string[] = [
    `b.deleteflag = 0`,
    `(b."dateTo" > '${nowDate}'::date OR (b."dateTo" = '${nowDate}'::date AND COALESCE(b."timeTo"::time, '23:59:59'::time) > '${nowTime}'::time))`,
  ];

  if (dateFrom) {
    whereConditions.push(`b."dateTo" >= '${dateFrom}'::date`);
  }
  if (dateTo) {
    whereConditions.push(`b."dateFrom" <= '${dateTo}'::date`);
  }

  if (search) {
    const searchLower = search.toLowerCase().replace(/'/g, "''");
    whereConditions.push(
      `(LOWER(b.name) LIKE '%${searchLower}%' OR LOWER(b.surname) LIKE '%${searchLower}%' OR LOWER(b.email) LIKE '%${searchLower}%' OR LOWER(b."plateNo") LIKE '%${searchLower}%')`
    );
  }

  const whereClause = whereConditions.join(" AND ");

  const countQuery = `SELECT COUNT(*) as count FROM bookings b WHERE ${whereClause}`;
  const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(countQuery);
  const total = Number(countResult[0].count);

  const offset = (page - 1) * limit;
  const dataQuery = `
    SELECT 
      b.id,
      b.name,
      b.surname,
      b.email,
      b."returnFlight",
      b."dateFrom",
      b."timeFrom",
      b."dateTo",
      b."timeTo",
      b.mobile,
      b."plateNo",
      b."carBrand",
      b."carModel",
      b."carColor",
      b."parkingTypeId",
      pt.name as "parkingTypeName",
      b.adults,
      b.deleteflag
    FROM bookings b
    LEFT JOIN parking_types pt ON b."parkingTypeId" = pt.id
    WHERE ${whereClause}
    ORDER BY b."dateTo" ASC, COALESCE(b."timeTo"::time, '23:59:59'::time) ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const bookings = await prisma.$queryRawUnsafe<any[]>(dataQuery);

  const data: BookingResponse[] = bookings.map((b: any) => ({
    id: b.id,
    name: b.name,
    surname: b.surname,
    email: b.email,
    returnFlight: b.returnFlight,
    dateFrom: formatDate(b.dateFrom),
    timeFrom: formatTime(b.timeFrom),
    dateTo: formatDate(b.dateTo),
    timeTo: formatTime(b.timeTo),
    mobile: b.mobile,
    plateNo: b.plateNo,
    carBrand: b.carBrand,
    carModel: b.carModel,
    carColor: b.carColor,
    parkingType: b.parkingTypeName,
    adults: b.adults,
    deleteflag: b.deleteflag,
  }));

  return {
    data,
    meta: { total, page, limit },
  };
}

export async function getBookingById(id: string): Promise<BookingResponse | null> {
  if (!isValidUUID(id)) return null;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { parkingType: true },
  });

  if (!booking) return null;

  return {
    id: booking.id,
    name: booking.name,
    surname: booking.surname,
    email: booking.email,
    returnFlight: booking.returnFlight,
    dateFrom: formatDate(booking.dateFrom),
    timeFrom: formatTime(booking.timeFrom),
    dateTo: formatDate(booking.dateTo),
    timeTo: formatTime(booking.timeTo),
    mobile: booking.mobile,
    plateNo: booking.plateNo,
    carBrand: booking.carBrand,
    carModel: booking.carModel,
    carColor: booking.carColor,
    parkingType: booking.parkingType?.name || null,
    adults: booking.adults,
    deleteflag: booking.deleteflag,
  };
}

export async function softDeleteBooking(id: string): Promise<{ id: string; deleteflag: number } | null> {
  if (!isValidUUID(id)) return null;

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) return null;

  const updated = await prisma.booking.update({
    where: { id },
    data: { deleteflag: 1 },
  });

  return {
    id: updated.id,
    deleteflag: updated.deleteflag,
  };
}

export { isValidDateFormat, isDateInPast, isValidUUID };
