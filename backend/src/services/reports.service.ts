import { prisma } from "../lib/prisma";
import {
  getDayEndMinutes,
  buildSingleDateCondition,
} from "../utils/dayEnd.utils";

export interface WashServiceReportItem {
  id: string;
  fullName: string;
  plateNo: string;
  vehicleModel: string;
  vehicleColor: string;
  carPickup: string;
  checkOutDate: string;
  checkOutTime: string;
}

function formatDisplayDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(time: Date | null): string {
  if (!time) return "";
  const hours = time.getUTCHours().toString().padStart(2, "0");
  const minutes = time.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

interface WashServiceRow {
  id: string;
  name: string;
  surname: string;
  plateNo: string | null;
  carBrand: string | null;
  carModel: string | null;
  carColor: string | null;
  pickUpOption: string | null;
  dateTo: Date;
  timeTo: Date | null;
}

export interface DailyInOutReportItem {
  id: string;
  bookingStatus: string;
  bookingType: string;
  time: string;
  flightNo: string;
  fullName: string;
  phone: string;
  plateNo: string;
  parkPlace: string;
  finalPrice: number | null;
  extraFee: number | null;
  adults: number | null;
}

interface DailyInOutRowWithStatus {
  id: string;
  name: string;
  surname: string;
  plateNo: string | null;
  dateFrom: Date;
  timeFrom: Date | null;
  dateTo: Date;
  timeTo: Date | null;
  returnFlight: string | null;
  bookingStatusId: string | null;
  bookingStatusName: string | null;
  mobile: string | null;
  phoneCode: string | null;
  parkPlace: string | null;
  finalPrice: number | null;
  extraFee: number | null;
  adults: number | null;
}

export async function getDailyInOutReport(
  date: string,
  filterBy: string = "both"
): Promise<DailyInOutReportItem[]> {
  const dayEndMinutes = await getDayEndMinutes();
  const checkInCondition = buildSingleDateCondition(date, "dateFrom", dayEndMinutes, "b");
  const checkOutCondition = buildSingleDateCondition(date, "dateTo", dayEndMinutes, "b");
  
  let whereClause = "";
  
  if (filterBy === "check-ins") {
    whereClause = `${checkInCondition} AND b."bookingStatusId" = 'bookingStatus_created'`;
  } else if (filterBy === "check-outs") {
    whereClause = `${checkOutCondition} AND b."bookingStatusId" = 'bookingStatus_parked'`;
  } else {
    whereClause = `(
        (${checkInCondition} AND b."bookingStatusId" = 'bookingStatus_created')
        OR (${checkOutCondition} AND b."bookingStatusId" = 'bookingStatus_parked')
      )`;
  }

  const bookings = await prisma.$queryRawUnsafe<DailyInOutRowWithStatus[]>(`
    SELECT b.id, b.name, b.surname, b."plateNo",
           b."dateFrom", b."timeFrom",
           b."dateTo", b."timeTo",
           b."returnFlight", b."bookingStatusId",
           bs.value as "bookingStatusName",
           b.mobile, pc."phoneCode",
           b."parkPlace", b."finalPrice", b."extraFee", b.adults
    FROM bookings b
    LEFT JOIN booking_statuses bs ON b."bookingStatusId" = bs.id
    LEFT JOIN phone_codes pc ON b."phoneCodeId" = pc.id
    WHERE b.deleteflag = 0 
      AND ${whereClause}
  `);

  const selectedDate = new Date(date);

  const results: DailyInOutReportItem[] = [];

  for (const b of bookings) {
    const dateFrom = new Date(b.dateFrom);
    const dateTo = new Date(b.dateTo);
    const isCheckInDate = dateFrom.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
    const isCheckOutDate = dateTo.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];

    const phone = b.phoneCode && b.mobile ? `${b.phoneCode} ${b.mobile}` : b.mobile || "-";

    if (isCheckInDate && b.bookingStatusId === 'bookingStatus_created') {
      results.push({
        id: b.id,
        bookingStatus: b.bookingStatusName || "-",
        bookingType: "In",
        time: formatTime(b.timeFrom),
        flightNo: b.returnFlight || "-",
        fullName: `${b.name} ${b.surname}`.trim(),
        phone,
        plateNo: b.plateNo || "",
        parkPlace: b.parkPlace || "-",
        finalPrice: b.finalPrice,
        extraFee: b.extraFee,
        adults: b.adults,
      });
    }

    if (isCheckOutDate && b.bookingStatusId === 'bookingStatus_parked') {
      results.push({
        id: b.id,
        bookingStatus: b.bookingStatusName || "-",
        bookingType: "Out",
        time: formatTime(b.timeTo),
        flightNo: b.returnFlight || "-",
        fullName: `${b.name} ${b.surname}`.trim(),
        phone,
        plateNo: b.plateNo || "",
        parkPlace: b.parkPlace || "-",
        finalPrice: b.finalPrice,
        extraFee: b.extraFee,
        adults: b.adults,
      });
    }
  }

  results.sort((a, c) => {
    if (!a.time && !c.time) return 0;
    if (!a.time) return 1;
    if (!c.time) return -1;
    return a.time.localeCompare(c.time);
  });

  return results;
}

export async function getWashServiceReport(
  date: string
): Promise<WashServiceReportItem[]> {
  const dayEndMinutes = await getDayEndMinutes();
  const checkOutCondition = buildSingleDateCondition(date, "dateTo", dayEndMinutes, "");
  
  const bookings = await prisma.$queryRawUnsafe<WashServiceRow[]>(`
    SELECT id, name, surname, "plateNo", "carBrand", "carModel", "carColor", "pickUpOption", "dateTo", "timeTo"
    FROM bookings 
    WHERE deleteflag = 0 
      AND ${checkOutCondition}
      AND "washService" = true
      AND "bookingStatusId" = 'bookingStatus_parked'
    ORDER BY "timeTo" ASC NULLS LAST, name ASC
  `);

  return bookings.map((b) => {
    const vehicleParts = [b.carBrand, b.carModel].filter(Boolean);
    return {
      id: b.id,
      fullName: `${b.name} ${b.surname}`.trim(),
      plateNo: b.plateNo || "",
      vehicleModel: vehicleParts.join(" ") || "-",
      vehicleColor: b.carColor || "-",
      carPickup: b.pickUpOption || "-",
      checkOutDate: formatDisplayDate(new Date(b.dateTo)),
      checkOutTime: formatTime(b.timeTo),
    };
  });
}
