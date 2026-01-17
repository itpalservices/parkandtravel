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
  return date.toISOString().split("T")[0];
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
  return `${day}/${month}`;
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
      AND "dateTo" >= '${todayStr}'::date
  `);

  const todayCheckInsResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateFrom" = '${todayStr}'::date
  `);

  const todayCheckOutsResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${todayStr}'::date
  `);

  const carsForWashTodayResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${todayStr}'::date
      AND "washService" = true
  `);

  const carsForWashTomorrowResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${tomorrowStr}'::date
      AND "washService" = true
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
