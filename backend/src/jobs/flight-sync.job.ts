import cron from 'node-cron';
import { prisma } from '../lib/prisma';

interface AirlabsFlight {
  flight_iata: string | null;
  flight_icao: string | null;
  arr_estimated_utc: string | null;
  arr_time_utc: string | null;
  status: string | null;
}

interface AirlabsResponse {
  response: AirlabsFlight[];
}

function normalizeFlight(code: string): string {
  return code.replace(/[\s\-\.]/g, '').toUpperCase();
}

function parseUtcString(utcStr: string): Date {
  return new Date(utcStr.replace(' ', 'T') + ':00Z');
}

function getTodayCyprus(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Nicosia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function runFlightSync(): Promise<void> {
  const todayStr = getTodayCyprus();
  const todayDate = new Date(todayStr);

  const bookings = await prisma.booking.findMany({
    where: {
      bookingStatusId: 'bookingStatus_parked',
      dateTo: todayDate,
      returnFlight: { not: null },
      deleteflag: 0,
    },
    select: {
      id: true,
      returnFlight: true,
      estimatedArrivalTime: true,
    },
  });

  if (bookings.length === 0) {
    return;
  }

  const apiKey = process.env.AIRLABS_API_KEY;
  if (!apiKey) {
    console.error('[Flight Sync] AIRLABS_API_KEY is not set. Skipping.');
    return;
  }

  const url = `https://airlabs.co/api/v9/schedules?arr_iata=LCA&api_key=${apiKey}&delayed=0`;

  let flights: AirlabsFlight[];
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[Flight Sync] API returned HTTP ${res.status}. Skipping.`);
      return;
    }
    const json = await res.json() as AirlabsResponse;
    flights = json.response ?? [];
  } catch (err) {
    console.error('[Flight Sync] API call failed:', err);
    return;
  }

  const flightMap = new Map<string, Date>();
  for (const f of flights) {
    if (f.status === 'cancelled') continue;

    const rawTime = f.arr_estimated_utc || f.arr_time_utc;
    if (!rawTime) continue;

    const arrivalTime = parseUtcString(rawTime);

    if (f.flight_iata) {
      flightMap.set(normalizeFlight(f.flight_iata), arrivalTime);
    }
    if (f.flight_icao) {
      flightMap.set(normalizeFlight(f.flight_icao), arrivalTime);
    }
  }

  let updatedCount = 0;

  for (const booking of bookings) {
    if (!booking.returnFlight) continue;

    const normalizedBookingFlight = normalizeFlight(booking.returnFlight);
    const newArrival = flightMap.get(normalizedBookingFlight);

    if (!newArrival) continue;

    const currentTime = booking.estimatedArrivalTime?.getTime() ?? null;
    const newTime = newArrival.getTime();

    if (currentTime === newTime) continue;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { estimatedArrivalTime: newArrival },
    });

    updatedCount++;
  }

  if (updatedCount > 0) {
    console.log(`[Flight Sync] Updated estimatedArrivalTime on ${updatedCount} booking(s) for ${todayStr}.`);
  }
}

export function startFlightSyncJob(): void {
  cron.schedule('0 */45 * * * *', async () => {
    try {
      await runFlightSync();
    } catch (err) {
      console.error('[Flight Sync] Job failed:', err);
    }
  });

  console.log('[Flight Sync] Job scheduled (every 45 min, LCA arrivals).');
}
