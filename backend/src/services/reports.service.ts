import { prisma } from "../lib/prisma";

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
  fullName: string;
  plateNo: string;
  vehicleModel: string;
  vehicleColor: string;
  checkInDate: string;
  checkInTime: string;
  carDropOff: string;
  checkOutDate: string;
  checkOutTime: string;
  carPickup: string;
  flightNo: string;
  parkingType: string;
  bookingType: string;
}

interface DailyInOutRow {
  id: string;
  name: string;
  surname: string;
  plateNo: string | null;
  carBrand: string | null;
  carModel: string | null;
  carColor: string | null;
  dateFrom: Date;
  timeFrom: Date | null;
  dropOffOption: string | null;
  dateTo: Date;
  timeTo: Date | null;
  pickUpOption: string | null;
  returnFlight: string | null;
  parkingTypeName: string | null;
}

interface DailyInOutRowWithStatus extends DailyInOutRow {
  bookingStatusId: string | null;
}

export async function getDailyInOutReport(
  date: string
): Promise<DailyInOutReportItem[]> {
  const bookings = await prisma.$queryRawUnsafe<DailyInOutRowWithStatus[]>(`
    SELECT b.id, b.name, b.surname, b."plateNo", b."carBrand", b."carModel", b."carColor",
           b."dateFrom", b."timeFrom", b."dropOffOption",
           b."dateTo", b."timeTo", b."pickUpOption",
           b."returnFlight", pt.name as "parkingTypeName", b."bookingStatusId"
    FROM bookings b
    LEFT JOIN parking_types pt ON b."parkingTypeId" = pt.id
    WHERE b.deleteflag = 0 
      AND (
        (b."dateFrom" = '${date}'::date AND b."bookingStatusId" = 'bookingStatus_created')
        OR (b."dateTo" = '${date}'::date AND b."bookingStatusId" = 'bookingStatus_parked')
      )
    ORDER BY b."dateFrom" ASC, b."timeFrom" ASC NULLS LAST, b.name ASC
  `);

  const selectedDate = new Date(date);

  return bookings.map((b) => {
    const vehicleParts = [b.carBrand, b.carModel].filter(Boolean);
    const dateFrom = new Date(b.dateFrom);
    const dateTo = new Date(b.dateTo);
    
    const isCheckInDate = dateFrom.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
    const isCheckOutDate = dateTo.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
    
    let bookingType = '';
    if (isCheckInDate && b.bookingStatusId === 'bookingStatus_created') {
      bookingType = 'In';
    }
    if (isCheckOutDate && b.bookingStatusId === 'bookingStatus_parked') {
      bookingType = bookingType === 'In' ? 'In/Out' : 'Out';
    }

    return {
      id: b.id,
      fullName: `${b.name} ${b.surname}`.trim(),
      plateNo: b.plateNo || "",
      vehicleModel: vehicleParts.join(" ") || "-",
      vehicleColor: b.carColor || "-",
      checkInDate: formatDisplayDate(new Date(b.dateFrom)),
      checkInTime: formatTime(b.timeFrom),
      carDropOff: b.dropOffOption || "-",
      checkOutDate: formatDisplayDate(new Date(b.dateTo)),
      checkOutTime: formatTime(b.timeTo),
      carPickup: b.pickUpOption || "-",
      flightNo: b.returnFlight || "-",
      parkingType: b.parkingTypeName || "-",
      bookingType,
    };
  });
}

export async function getWashServiceReport(
  date: string
): Promise<WashServiceReportItem[]> {
  const bookings = await prisma.$queryRawUnsafe<WashServiceRow[]>(`
    SELECT id, name, surname, "plateNo", "carBrand", "carModel", "carColor", "pickUpOption", "dateTo", "timeTo"
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${date}'::date
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
