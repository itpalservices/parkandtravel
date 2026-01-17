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

export async function getWashServiceReport(
  date: string
): Promise<WashServiceReportItem[]> {
  const bookings = await prisma.$queryRawUnsafe<WashServiceRow[]>(`
    SELECT id, name, surname, "plateNo", "carBrand", "carModel", "carColor", "pickUpOption", "dateTo", "timeTo"
    FROM bookings 
    WHERE deleteflag = 0 
      AND "dateTo" = '${date}'::date
      AND "washService" = true
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
