import { prisma } from "../lib/prisma";

export interface DashboardStats {
  totalCars: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  carsForWashToday: number;
  carsForWashTomorrow: number;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
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
