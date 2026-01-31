import { prisma } from "../lib/prisma";

interface SettingRow {
  id: string;
  value: string | null;
}

export async function getDayEndMinutes(): Promise<number> {
  const result = await prisma.$queryRawUnsafe<SettingRow[]>(
    `SELECT value FROM configuration_settings WHERE id = 'configurationSetting_dayEnd'`
  );
  
  if (result.length === 0 || !result[0].value) {
    return 0;
  }
  
  const minutes = parseInt(result[0].value, 10);
  return isNaN(minutes) ? 0 : minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:00`;
}

export function getNextDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDateFromCondition(
  dateFrom: string,
  dateTo: string,
  dayEndMinutes: number,
  tableAlias: string = "b"
): string {
  if (dayEndMinutes <= 0) {
    return `(${tableAlias}."dateFrom" >= '${dateFrom}'::date AND ${tableAlias}."dateFrom" <= '${dateTo}'::date)`;
  }
  
  const extendedDate = getNextDay(dateTo);
  const timeLimit = formatMinutesToTime(dayEndMinutes);
  
  return `(
    (${tableAlias}."dateFrom" >= '${dateFrom}'::date AND ${tableAlias}."dateFrom" < '${extendedDate}'::date)
    OR (${tableAlias}."dateFrom" = '${extendedDate}'::date AND ${tableAlias}."timeFrom" IS NOT NULL AND ${tableAlias}."timeFrom" <= '${timeLimit}'::time)
  )`;
}

export function buildDateToCondition(
  dateFrom: string,
  dateTo: string,
  dayEndMinutes: number,
  tableAlias: string = "b"
): string {
  if (dayEndMinutes <= 0) {
    return `(${tableAlias}."dateTo" >= '${dateFrom}'::date AND ${tableAlias}."dateTo" <= '${dateTo}'::date)`;
  }
  
  const extendedDate = getNextDay(dateTo);
  const timeLimit = formatMinutesToTime(dayEndMinutes);
  
  return `(
    (${tableAlias}."dateTo" >= '${dateFrom}'::date AND ${tableAlias}."dateTo" < '${extendedDate}'::date)
    OR (${tableAlias}."dateTo" = '${extendedDate}'::date AND ${tableAlias}."timeTo" IS NOT NULL AND ${tableAlias}."timeTo" <= '${timeLimit}'::time)
  )`;
}

export function buildSingleDateCondition(
  date: string,
  field: "dateFrom" | "dateTo",
  dayEndMinutes: number,
  tableAlias: string = "b"
): string {
  const timeField = field === "dateFrom" ? "timeFrom" : "timeTo";
  const prefix = tableAlias ? `${tableAlias}.` : "";
  
  if (dayEndMinutes <= 0) {
    return `${prefix}"${field}" = '${date}'::date`;
  }
  
  const nextDay = getNextDay(date);
  const timeLimit = formatMinutesToTime(dayEndMinutes);
  
  return `(
    ${prefix}"${field}" = '${date}'::date
    OR (${prefix}"${field}" = '${nextDay}'::date AND ${prefix}"${timeField}" IS NOT NULL AND ${prefix}"${timeField}" <= '${timeLimit}'::time)
  )`;
}

export function buildBothDatesCondition(
  dateFrom: string,
  dateTo: string,
  dayEndMinutes: number,
  tableAlias: string = "b"
): string {
  const dateFromCond = buildDateFromCondition(dateFrom, dateTo, dayEndMinutes, tableAlias);
  const dateToCond = buildDateToCondition(dateFrom, dateTo, dayEndMinutes, tableAlias);
  
  return `(${dateFromCond} OR ${dateToCond})`;
}
