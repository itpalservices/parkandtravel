import { prisma } from "../lib/prisma";

export interface DashboardStats {
  totalCars: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  carsForWashToday: number;
  carsForWashTomorrow: number;
}

export interface CheckInOutItem {
  id: string;
  plateNo: string;
  customerName: string;
  date: string;
  time: string;
  flightNumber: string;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(time: Date | null): string {
  if (!time) return "";
  const hours = time.getUTCHours().toString().padStart(2, "0");
  const minutes = time.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDisplayDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const totalCarsResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateFrom" <= '${todayStr}'::date 
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  const todayCheckInsResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateFrom" = '${todayStr}'::date
      AND "bookingStatusId" = 'bookingStatus_created'
  `);

  const todayCheckOutsResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${todayStr}'::date
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  const carsForWashTodayResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${todayStr}'::date
      AND "washService" = true
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  const carsForWashTomorrowResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${tomorrowStr}'::date
      AND "washService" = true
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  return {
    totalCars: Number(totalCarsResult[0]?.count || 0),
    todayCheckIns: Number(todayCheckInsResult[0]?.count || 0),
    todayCheckOuts: Number(todayCheckOutsResult[0]?.count || 0),
    carsForWashToday: Number(carsForWashTodayResult[0]?.count || 0),
    carsForWashTomorrow: Number(carsForWashTomorrowResult[0]?.count || 0),
  };
}

interface BookingRow {
  id: string;
  plateNo: string | null;
  name: string;
  surname: string;
  dateFrom: Date;
  dateTo: Date;
  timeFrom: Date | null;
  timeTo: Date | null;
  returnFlight: string | null;
}

export async function getCheckIns(
  dateFrom: string,
  dateTo: string
): Promise<CheckInOutItem[]> {
  const bookings = await prisma.$queryRawUnsafe<BookingRow[]>(`
    SELECT id, "plateNo", name, surname, "dateFrom", "timeFrom", "returnFlight"
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateFrom" >= '${dateFrom}'::date 
      AND "dateFrom" <= '${dateTo}'::date
      AND "bookingStatusId" = 'bookingStatus_created'
    ORDER BY "dateFrom" ASC, "timeFrom" ASC
  `);

  return bookings.map((b) => ({
    id: b.id,
    plateNo: b.plateNo || "",
    customerName: `${b.name} ${b.surname}`.trim(),
    date: formatDisplayDate(new Date(b.dateFrom)),
    time: formatTime(b.timeFrom),
    flightNumber: b.returnFlight || "",
  }));
}

export async function getCheckOuts(
  dateFrom: string,
  dateTo: string
): Promise<CheckInOutItem[]> {
  const bookings = await prisma.$queryRawUnsafe<BookingRow[]>(`
    SELECT id, "plateNo", name, surname, "dateTo", "timeTo", "returnFlight"
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" >= '${dateFrom}'::date 
      AND "dateTo" <= '${dateTo}'::date
      AND "bookingStatusId" = 'bookingStatus_parked'
    ORDER BY "dateTo" ASC, "timeTo" ASC
  `);

  return bookings.map((b) => ({
    id: b.id,
    plateNo: b.plateNo || "",
    customerName: `${b.name} ${b.surname}`.trim(),
    date: formatDisplayDate(new Date(b.dateTo)),
    time: formatTime(b.timeTo),
    flightNumber: b.returnFlight || "",
  }));
}

export interface DashboardDetailItem {
  id: string;
  customerName: string;
  plateNo: string;
  vehicleModel: string;
  checkIn: string;
  checkOut: string;
}

interface DetailBookingRow {
  id: string;
  name: string | null;
  surname: string | null;
  plateNo: string | null;
  carModel: string | null;
  dateFrom: Date;
  dateTo: Date;
  timeFrom: Date | null;
  timeTo: Date | null;
}

export async function getCardDetails(
  cardType: string
): Promise<DashboardDetailItem[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  let query = "";

  switch (cardType) {
    case "total-cars":
      query = `
        SELECT id, name, surname, "plateNo", "carModel", "dateFrom", "dateTo", "timeFrom", "timeTo"
        FROM bookings 
        WHERE deleteflag = 0 
          AND "dateFrom" <= '${todayStr}'::date 
          AND "bookingStatusId" = 'bookingStatus_parked'
        ORDER BY "dateFrom" DESC
      `;
      break;
    case "today-check-ins":
      query = `
        SELECT id, name, surname, "plateNo", "carModel", "dateFrom", "dateTo", "timeFrom", "timeTo"
        FROM bookings 
        WHERE deleteflag = 0 
          AND "dateFrom" = '${todayStr}'::date
          AND "bookingStatusId" = 'bookingStatus_created'
        ORDER BY "timeFrom" ASC
      `;
      break;
    case "today-check-outs":
      query = `
        SELECT id, name, surname, "plateNo", "carModel", "dateFrom", "dateTo", "timeFrom", "timeTo"
        FROM bookings 
        WHERE deleteflag = 0 
          AND "dateTo" = '${todayStr}'::date
          AND "bookingStatusId" = 'bookingStatus_parked'
        ORDER BY "timeTo" ASC
      `;
      break;
    case "wash-today":
      query = `
        SELECT id, name, surname, "plateNo", "carModel", "dateFrom", "dateTo", "timeFrom", "timeTo"
        FROM bookings 
        WHERE deleteflag = 0 
          AND "dateTo" = '${todayStr}'::date
          AND "washService" = true
          AND "bookingStatusId" = 'bookingStatus_parked'
        ORDER BY "timeTo" ASC
      `;
      break;
    case "wash-tomorrow":
      query = `
        SELECT id, name, surname, "plateNo", "carModel", "dateFrom", "dateTo", "timeFrom", "timeTo"
        FROM bookings 
        WHERE deleteflag = 0 
          AND "dateTo" = '${tomorrowStr}'::date
          AND "washService" = true
          AND "bookingStatusId" = 'bookingStatus_parked'
        ORDER BY "timeTo" ASC
      `;
      break;
    default:
      return [];
  }

  const bookings = await prisma.$queryRawUnsafe<DetailBookingRow[]>(query);

  return bookings.map((b) => ({
    id: b.id,
    customerName: `${b.name || ""} ${b.surname || ""}`.trim(),
    plateNo: b.plateNo || "",
    vehicleModel: b.carModel || "",
    checkIn: `${formatDisplayDate(new Date(b.dateFrom))} ${formatTime(b.timeFrom)}`,
    checkOut: `${formatDisplayDate(new Date(b.dateTo))} ${formatTime(b.timeTo)}`,
  }));
}
