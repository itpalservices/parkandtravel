import { prisma } from "../lib/prisma";
import {
  getDayEndMinutes,
  buildSingleDateCondition,
  getNextDay,
  formatMinutesToTime,
} from "../utils/dayEnd.utils";

export interface DashboardStats {
  totalCars: number;
  todayCheckIns: number;
  todayCheckInsAmount: number;
  todayCheckOuts: number;
  todayCheckOutsAmount: number;
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

  const dayEndMinutes = await getDayEndMinutes();
  
  const todayCheckInCondition = buildSingleDateCondition(todayStr, "dateFrom", dayEndMinutes, "");
  const todayCheckOutCondition = buildSingleDateCondition(todayStr, "dateTo", dayEndMinutes, "");
  const tomorrowCheckOutCondition = buildSingleDateCondition(tomorrowStr, "dateTo", dayEndMinutes, "");

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
      AND ${todayCheckInCondition}
      AND "bookingStatusId" = 'bookingStatus_created'
  `);

  const todayCheckInsAmountResult = await prisma.$queryRawUnsafe<{ amount: bigint }[]>(`
    SELECT SUM("finalPrice")+SUM(COALESCE("extraFee",0)) as amount
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${todayCheckInCondition}
      AND "bookingStatusId" = 'bookingStatus_created'
  `);

  const todayCheckOutsResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${todayCheckOutCondition}
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  const todayCheckOutsAmountResult = await prisma.$queryRawUnsafe<{ amount: bigint }[]>(`
    SELECT SUM("finalPrice")+SUM(COALESCE("extraFee",0)) as amount 
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${todayCheckOutCondition}
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  const carsForWashTodayResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${todayCheckOutCondition}
      AND "washService" = true
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  const carsForWashTomorrowResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) as count 
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${tomorrowCheckOutCondition}
      AND "washService" = true
      AND "bookingStatusId" = 'bookingStatus_parked'
  `);

  return {
    totalCars: Number(totalCarsResult[0]?.count || 0),
    todayCheckIns: Number(todayCheckInsResult[0]?.count || 0),
    todayCheckInsAmount: Number(todayCheckInsAmountResult[0]?.amount || 0),
    todayCheckOuts: Number(todayCheckOutsResult[0]?.count || 0),
    todayCheckOutsAmount: Number(todayCheckOutsAmountResult[0]?.amount || 0),
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
  const dayEndMinutes = await getDayEndMinutes();
  let dateCondition = `"dateFrom" >= '${dateFrom}'::date AND "dateFrom" <= '${dateTo}'::date`;
  
  if (dayEndMinutes > 0) {
    const extendedDate = getNextDay(dateTo);
    const timeLimit = formatMinutesToTime(dayEndMinutes);
    dateCondition = `(
      ("dateFrom" >= '${dateFrom}'::date AND "dateFrom" < '${extendedDate}'::date)
      OR ("dateFrom" = '${extendedDate}'::date AND "timeFrom" IS NOT NULL AND "timeFrom" <= '${timeLimit}'::time)
    )`;
  }

  const bookings = await prisma.$queryRawUnsafe<BookingRow[]>(`
    SELECT id, "plateNo", name, surname, "dateFrom", "timeFrom", "returnFlight"
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${dateCondition}
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
  const dayEndMinutes = await getDayEndMinutes();
  let dateCondition = `"dateTo" >= '${dateFrom}'::date AND "dateTo" <= '${dateTo}'::date`;
  
  if (dayEndMinutes > 0) {
    const extendedDate = getNextDay(dateTo);
    const timeLimit = formatMinutesToTime(dayEndMinutes);
    dateCondition = `(
      ("dateTo" >= '${dateFrom}'::date AND "dateTo" < '${extendedDate}'::date)
      OR ("dateTo" = '${extendedDate}'::date AND "timeTo" IS NOT NULL AND "timeTo" <= '${timeLimit}'::time)
    )`;
  }

  const bookings = await prisma.$queryRawUnsafe<BookingRow[]>(`
    SELECT id, "plateNo", name, surname, "dateTo", "timeTo", "returnFlight"
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${dateCondition}
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
  phoneNumber: string;
  phoneCode: string | null;
  plateNo: string;
  vehicleModel: string;
  checkIn: string;
  checkOut: string;
  parkPlace?: string;
}

interface DetailBookingRow {
  id: string;
  name: string | null;
  surname: string | null;
  mobile: string | null;
  phoneCodeValue: string | null;
  plateNo: string | null;
  carBrand: string | null;
  carModel: string | null;
  dateFrom: Date;
  dateTo: Date;
  timeFrom: Date | null;
  timeTo: Date | null;
  parkPlace: string | null;
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

  const dayEndMinutes = await getDayEndMinutes();
  const todayCheckInCondition = buildSingleDateCondition(todayStr, "dateFrom", dayEndMinutes, "");
  const todayCheckOutCondition = buildSingleDateCondition(todayStr, "dateTo", dayEndMinutes, "");
  const tomorrowCheckOutCondition = buildSingleDateCondition(tomorrowStr, "dateTo", dayEndMinutes, "");

  let query = "";

  switch (cardType) {
    case "total-cars":
      query = `
        SELECT b.id, b.name, b.surname, b.mobile, pc."phoneCode" as "phoneCodeValue", b."plateNo", b."carBrand", b."carModel", b."dateFrom", b."dateTo", b."timeFrom", b."timeTo", b."parkPlace"
        FROM bookings b
        LEFT JOIN phone_codes pc ON b."phoneCodeId" = pc.id
        WHERE b.deleteflag = 0
          AND b."dateFrom" <= '${todayStr}'::date
          AND b."bookingStatusId" = 'bookingStatus_parked'
        ORDER BY b."dateFrom" DESC
      `;
      break;
    case "today-check-ins":
      query = `
        SELECT b.id, b.name, b.surname, b.mobile, pc."phoneCode" as "phoneCodeValue", b."plateNo", b."carBrand", b."carModel", b."dateFrom", b."dateTo", b."timeFrom", b."timeTo", NULL as "parkPlace"
        FROM bookings b
        LEFT JOIN phone_codes pc ON b."phoneCodeId" = pc.id
        WHERE b.deleteflag = 0
          AND ${todayCheckInCondition}
          AND b."bookingStatusId" = 'bookingStatus_created'
        ORDER BY b."timeFrom" ASC
      `;
      break;
    case "today-check-outs":
      query = `
        SELECT b.id, b.name, b.surname, b.mobile, pc."phoneCode" as "phoneCodeValue", b."plateNo", b."carBrand", b."carModel", b."dateFrom", b."dateTo", b."timeFrom", b."timeTo", b."parkPlace"
        FROM bookings b
        LEFT JOIN phone_codes pc ON b."phoneCodeId" = pc.id
        WHERE b.deleteflag = 0
          AND ${todayCheckOutCondition}
          AND b."bookingStatusId" = 'bookingStatus_parked'
        ORDER BY b."timeTo" ASC
      `;
      break;
    case "wash-today":
      query = `
        SELECT b.id, b.name, b.surname, b.mobile, pc."phoneCode" as "phoneCodeValue", b."plateNo", b."carBrand", b."carModel", b."dateFrom", b."dateTo", b."timeFrom", b."timeTo", b."parkPlace"
        FROM bookings b
        LEFT JOIN phone_codes pc ON b."phoneCodeId" = pc.id
        WHERE b.deleteflag = 0
          AND ${todayCheckOutCondition}
          AND b."washService" = true
          AND b."bookingStatusId" = 'bookingStatus_parked'
        ORDER BY b."timeTo" ASC
      `;
      break;
    case "wash-tomorrow":
      query = `
        SELECT b.id, b.name, b.surname, b.mobile, pc."phoneCode" as "phoneCodeValue", b."plateNo", b."carBrand", b."carModel", b."dateFrom", b."dateTo", b."timeFrom", b."timeTo", b."parkPlace"
        FROM bookings b
        LEFT JOIN phone_codes pc ON b."phoneCodeId" = pc.id
        WHERE b.deleteflag = 0
          AND ${tomorrowCheckOutCondition}
          AND b."washService" = true
          AND b."bookingStatusId" = 'bookingStatus_parked'
        ORDER BY b."timeTo" ASC
      `;
      break;
    default:
      return [];
  }

  const bookings = await prisma.$queryRawUnsafe<DetailBookingRow[]>(query);

  return bookings.map((b) => ({
    id: b.id,
    customerName: `${b.name || ""} ${b.surname || ""}`.trim(),
    phoneNumber: b.mobile || "",
    phoneCode: b.phoneCodeValue || null,
    plateNo: b.plateNo || "",
    vehicleModel: `${b.carBrand || ""} ${b.carModel || ""}`.trim(),
    checkIn: `${formatDisplayDate(new Date(b.dateFrom))} ${formatTime(b.timeFrom)}`,
    checkOut: b.dateTo ? `${formatDisplayDate(new Date(b.dateTo))} ${formatTime(b.timeTo)}` : '',
    parkPlace: b.parkPlace || undefined,
  }));
}
