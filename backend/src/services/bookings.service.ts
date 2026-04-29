import { prisma } from "../lib/prisma";
import {
  getDayEndMinutes,
  buildDateFromCondition,
  buildDateToCondition,
  buildBothDatesCondition,
  getNextDay,
  formatMinutesToTime,
} from "../utils/dayEnd.utils";
import { sendBookingConfirmationEmail } from "./email.service";
import { checkAvailability } from "./availability.service";

async function getEmailDescription(): Promise<string | null> {
  const result = await prisma.$queryRawUnsafe<{ value: string | null }[]>(
    `SELECT value FROM configuration_settings WHERE id = $1`,
    'configurationSetting_emailDescription'
  );
  return result.length > 0 ? result[0].value : null;
}

interface GetBookingsParams {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page: number;
  limit: number;
  userId?: string;
  filterBy?: 'check-ins' | 'check-outs' | 'both';
}

interface BookingResponse {
  id: string;
  name: string;
  surname: string;
  email: string | null;
  returnFlight: string | null;
  dateFrom: string;
  timeFrom: string | null;
  dateTo: string | null;
  timeTo: string | null;
  mobile: string | null;
  phoneCodeId: string | null;
  plateNo: string | null;
  carBrand: string | null;
  carModel: string | null;
  carColor: string | null;
  parkingType: string | null;
  parkingTypeId: string | null;
  adults: number | null;
  washService: boolean;
  finalPrice: number | null;
  dropOffOption: string | null;
  pickUpOption: string | null;
  userId: string | null;
  bookingStatusId: string | null;
  bookingStatus: string | null;
  parkPlace: string | null;
  keepKeys: boolean | null;
  mileageKm: number | null;
  parkingComments: string | null;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  extraFee: number | null;
  deleteflag: number;
  paidAmount: number;
  checkInBy: string | null;
  checkOutBy: string | null;
  paymentStatus: 'paid' | 'partial' | 'overpaid' | 'unpaid' | null;
  isPrepaid: boolean;
  walleePayment: { amount: number; createdAt: string } | null;
  estimated_arrival_time: string | null;
}

function derivePaymentStatus(
  finalPrice: number | null,
  paidAmount: number
): 'paid' | 'partial' | 'overpaid' | 'unpaid' | null {
  if (finalPrice === null) return null;
  if (paidAmount === 0) return 'unpaid';
  if (paidAmount === finalPrice) return 'paid';
  if (paidAmount < finalPrice) return 'partial';
  return 'overpaid';
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
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
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function getBookings(params: GetBookingsParams): Promise<{
  data: BookingResponse[];
  meta: { total: number; page: number };
}> {
  const { dateFrom, dateTo, search, page, limit, userId, filterBy = 'both' } = params;
  const dayEndMinutes = await getDayEndMinutes();

  const whereConditions: string[] = [
    `b.deleteflag = 0`,
  ];

  if (userId) {
    whereConditions.push(`b."userId" = '${userId}'`);
  }

  if (dateFrom && dateTo) {
    if (filterBy === 'check-ins') {
      whereConditions.push(buildDateFromCondition(dateFrom, dateTo, dayEndMinutes, "b"));
    } else if (filterBy === 'check-outs') {
      const dateToCondition = buildDateToCondition(dateFrom, dateTo, dayEndMinutes, "b");
      whereConditions.push(
        `(${dateToCondition} OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date >= '${dateFrom}'::date AND b."actualCheckOut"::date <= '${dateTo}'::date))`,
      );
    } else {
      whereConditions.push(buildBothDatesCondition(dateFrom, dateTo, dayEndMinutes, "b"));
    }
  } else if (dateFrom) {
    if (filterBy === 'check-ins') {
      whereConditions.push(
        `(b."dateFrom" >= '${dateFrom}'::date)`,
      );
    } else if (filterBy === 'check-outs') {
      whereConditions.push(
        `((b."dateTo" >= '${dateFrom}'::date) OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date >= '${dateFrom}'::date))`,
      );
    } else {
      whereConditions.push(
        `(b."dateFrom" >= '${dateFrom}'::date OR b."dateTo" >= '${dateFrom}'::date)`,
      );
    }
  } else if (dateTo) {
    if (dayEndMinutes > 0) {
      const extendedDate = getNextDay(dateTo);
      const timeLimit = formatMinutesToTime(dayEndMinutes);
      if (filterBy === 'check-ins') {
        whereConditions.push(
          `(b."dateFrom" < '${extendedDate}'::date OR (b."dateFrom" = '${extendedDate}'::date AND b."timeFrom" IS NOT NULL AND b."timeFrom" <= '${timeLimit}'::time))`,
        );
      } else if (filterBy === 'check-outs') {
        whereConditions.push(
          `((b."dateTo" < '${extendedDate}'::date OR (b."dateTo" = '${extendedDate}'::date AND b."timeTo" IS NOT NULL AND b."timeTo" <= '${timeLimit}'::time)) OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date <= '${dateTo}'::date))`,
        );
      } else {
        whereConditions.push(
          `((b."dateFrom" < '${extendedDate}'::date OR (b."dateFrom" = '${extendedDate}'::date AND b."timeFrom" IS NOT NULL AND b."timeFrom" <= '${timeLimit}'::time)) OR (b."dateTo" < '${extendedDate}'::date OR (b."dateTo" = '${extendedDate}'::date AND b."timeTo" IS NOT NULL AND b."timeTo" <= '${timeLimit}'::time)))`,
        );
      }
    } else {
      if (filterBy === 'check-ins') {
        whereConditions.push(
          `(b."dateFrom" <= '${dateTo}'::date)`,
        );
      } else if (filterBy === 'check-outs') {
        whereConditions.push(
          `((b."dateTo" <= '${dateTo}'::date) OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date <= '${dateTo}'::date))`,
        );
      } else {
        whereConditions.push(
          `(b."dateFrom" <= '${dateTo}'::date OR b."dateTo" <= '${dateTo}'::date)`,
        );
      }
    }
  }

  if (search) {
    const searchLower = search.toLowerCase().replace(/'/g, "''");
    whereConditions.push(
      `(LOWER(b.name) LIKE '%${searchLower}%' OR LOWER(b.surname) LIKE '%${searchLower}%' OR LOWER(b.email) LIKE '%${searchLower}%' OR LOWER(b."plateNo") LIKE '%${searchLower}%')`,
    );
  }

  let whereClause = whereConditions.join(" AND ");

  if (filterBy === 'both' && dateFrom) {
    whereClause += ` OR (b."bookingStatusId" = 'bookingStatus_parked' AND b."dateTo" < '${dateFrom}'::date AND b.deleteflag = 0)`;
  }

  if (filterBy === 'both') {
    if (dateFrom && dateTo) {
      whereClause += ` OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date >= '${dateFrom}'::date AND b."actualCheckOut"::date <= '${dateTo}'::date AND b.deleteflag = 0)`;
    } else if (dateFrom) {
      whereClause += ` OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date >= '${dateFrom}'::date AND b.deleteflag = 0)`;
    } else if (dateTo) {
      whereClause += ` OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date <= '${dateTo}'::date AND b.deleteflag = 0)`;
    }
  }

  const countQuery = `SELECT COUNT(*) as count FROM bookings b WHERE ${whereClause}`;
  const countResult =
    await prisma.$queryRawUnsafe<{ count: bigint }[]>(countQuery);
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
      b."phoneCodeId",
      b."plateNo",
      b."carBrand",
      b."carModel",
      b."carColor",
      b."parkingTypeId",
      pt.name as "parkingTypeName",
      b.adults,
      b."washService",
      b."finalPrice",
      b."dropOffOption",
      b."pickUpOption",
      b.deleteflag,
      b."userId",
      b."bookingStatusId",
      bs.value as "bookingStatusValue",
      b."parkPlace",
      b."keepKeys",
      b."mileageKm",
      b."parkingComments",
      b."actualCheckIn",
      b."actualCheckOut",
      b."extraFee",
      b."checkInBy",
      b."checkOutBy",
      COALESCE((SELECT SUM(wt.amount) FROM wallee_transactions wt WHERE wt."bookingId" = b.id), 0) as "paidAmount",
      b."estimated_arrival_time"
    FROM bookings b
    LEFT JOIN parking_types pt ON b."parkingTypeId" = pt.id
    LEFT JOIN booking_statuses bs ON b."bookingStatusId" = bs.id
    WHERE ${whereClause}
    ORDER BY b."dateTo" ASC, COALESCE(b."timeTo"::time, '23:59:59'::time) ASC
  `;

  const bookings = await prisma.$queryRawUnsafe<any[]>(dataQuery);

  const data: BookingResponse[] = bookings.map((b: any) => ({
    id: b.id,
    name: b.name,
    surname: b.surname,
    email: b.email,
    returnFlight: b.returnFlight,
    dateFrom: formatDate(b.dateFrom)!,
    timeFrom: formatTime(b.timeFrom),
    dateTo: formatDate(b.dateTo),
    timeTo: formatTime(b.timeTo),
    mobile: b.mobile,
    phoneCodeId: b.phoneCodeId || null,
    plateNo: b.plateNo,
    carBrand: b.carBrand,
    carModel: b.carModel,
    carColor: b.carColor,
    parkingType: b.parkingTypeName,
    parkingTypeId: b.parkingTypeId || null,
    adults: b.adults,
    washService: b.washService ?? false,
    finalPrice: b.finalPrice !== null ? parseFloat(b.finalPrice) : null,
    dropOffOption: b.dropOffOption || null,
    pickUpOption: b.pickUpOption || null,
    userId: b.userId || null,
    bookingStatusId: b.bookingStatusId || null,
    bookingStatus: b.bookingStatusValue || null,
    parkPlace: b.parkPlace || null,
    keepKeys: b.keepKeys ?? null,
    mileageKm: b.mileageKm ?? null,
    parkingComments: b.parkingComments || null,
    actualCheckIn: b.actualCheckIn ? b.actualCheckIn.toISOString() : null,
    actualCheckOut: b.actualCheckOut ? b.actualCheckOut.toISOString() : null,
    extraFee: b.extraFee !== null ? parseFloat(b.extraFee) : null,
    deleteflag: b.deleteflag,
    paidAmount: parseFloat(b.paidAmount ?? '0'),
    checkInBy: b.checkInBy,
    checkOutBy: b.checkOutBy,
    paymentStatus: derivePaymentStatus(
      b.finalPrice !== null ? parseFloat(b.finalPrice) : null,
      parseFloat(b.paidAmount ?? '0')
    ),
    isPrepaid: parseFloat(b.paidAmount ?? '0') > 0,
    walleePayment: null,
    estimated_arrival_time: b.estimated_arrival_time
  }));

  return {
    data,
    meta: { total, page },
  };
}

export async function getBookingById(
  id: string,
): Promise<BookingResponse | null> {
  if (!isValidUUID(id)) return null;

  const bookings = await prisma.$queryRawUnsafe<any[]>(`
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
      b."phoneCodeId",
      b."plateNo",
      b."carBrand",
      b."carModel",
      b."carColor",
      b."parkingTypeId",
      pt.name as "parkingTypeName",
      b.adults,
      b."washService",
      b."finalPrice",
      b."dropOffOption",
      b."pickUpOption",
      b."userId",
      b."bookingStatusId",
      bs.value as "bookingStatusValue",
      b."parkPlace",
      b."keepKeys",
      b."mileageKm",
      b."parkingComments",
      b."actualCheckIn",
      b."actualCheckOut",
      b."extraFee",
      b.deleteflag,
      b."checkInBy",
      b."checkOutBy",
      COALESCE((SELECT SUM(wt.amount) FROM wallee_transactions wt WHERE wt."bookingId" = b.id), 0) as "paidAmount",
      (SELECT wt.amount FROM wallee_transactions wt WHERE wt."bookingId" = b.id ORDER BY wt."created_at" DESC LIMIT 1) as "walleeAmount",
      (SELECT wt."created_at" FROM wallee_transactions wt WHERE wt."bookingId" = b.id ORDER BY wt."created_at" DESC LIMIT 1) as "walleeCreatedAt",
      b.estimated_arrival_time
    FROM bookings b
    LEFT JOIN parking_types pt ON b."parkingTypeId" = pt.id
    LEFT JOIN booking_statuses bs ON b."bookingStatusId" = bs.id
    WHERE b.id = $1
  `, id);

  if (bookings.length === 0) return null;
  const b = bookings[0];

  return {
    id: b.id,
    name: b.name,
    surname: b.surname,
    email: b.email,
    returnFlight: b.returnFlight,
    dateFrom: formatDate(b.dateFrom)!,
    timeFrom: formatTime(b.timeFrom),
    dateTo: formatDate(b.dateTo),
    timeTo: formatTime(b.timeTo),
    mobile: b.mobile,
    phoneCodeId: b.phoneCodeId || null,
    plateNo: b.plateNo,
    carBrand: b.carBrand,
    carModel: b.carModel,
    carColor: b.carColor,
    parkingType: b.parkingTypeName || null,
    parkingTypeId: b.parkingTypeId || null,
    adults: b.adults,
    washService: b.washService ?? false,
    finalPrice: b.finalPrice !== null ? parseFloat(b.finalPrice) : null,
    dropOffOption: b.dropOffOption || null,
    pickUpOption: b.pickUpOption || null,
    userId: b.userId || null,
    bookingStatusId: b.bookingStatusId || null,
    bookingStatus: b.bookingStatusValue || null,
    parkPlace: b.parkPlace || null,
    keepKeys: b.keepKeys ?? null,
    mileageKm: b.mileageKm ?? null,
    parkingComments: b.parkingComments || null,
    actualCheckIn: b.actualCheckIn ? b.actualCheckIn.toISOString() : null,
    actualCheckOut: b.actualCheckOut ? b.actualCheckOut.toISOString() : null,
    extraFee: b.extraFee !== null ? parseFloat(b.extraFee) : null,
    deleteflag: b.deleteflag,
    checkInBy: b.checkInBy,
    checkOutBy: b.checkOutBy,
    paidAmount: parseFloat(b.paidAmount ?? '0'),
    paymentStatus: derivePaymentStatus(
      b.finalPrice !== null ? parseFloat(b.finalPrice) : null,
      parseFloat(b.paidAmount ?? '0')
    ),
    isPrepaid: parseFloat(b.paidAmount ?? '0') > 0,
    walleePayment: b.walleeAmount
      ? { amount: parseFloat(b.walleeAmount), createdAt: (b.walleeCreatedAt as Date).toISOString() }
      : null,      
    estimated_arrival_time: b.estimated_arrival_time
  };
}

export async function softDeleteBooking(
  id: string,
): Promise<{ id: string; deleteflag: number } | null> {
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

interface CreateGuestBookingParams {
  fullName: string;
  email: string;
  phone: string;
  phoneCodeId?: string | null;
  licensePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  flightNumber?: string | null;
  checkInDate: string;
  checkInTime: string;
  checkOutDate?: string | null;
  checkOutTime?: string | null;
  parkingTypeId: string;
  washService?: boolean;
  dropOffOption?: string | null;
  pickUpOption?: string | null;
}

export interface CreateBookingParams extends CreateGuestBookingParams {
  userId?: string | null;
  finalPrice?: number | null;
  discountPercentage?: number | null;
}

function parseTimeToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

function calculateDays(checkInDate: Date, checkOutDate: Date): number {
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1); // Minimum 1 day
}

async function getPriceSettings(): Promise<{
  priceUncovered: number | null;
  priceCovered: number | null;
  priceWash: number | null;
  deliveryFee: number | null;
  priceIncrementsCovered: number[] | null;
  priceIncrementsUncovered: number[] | null;
  mandatoryPrePayment: boolean;
}> {
  const settings = await prisma.$queryRawUnsafe<{ id: string; value: string | null }[]>(
    `SELECT id, value FROM configuration_settings WHERE id IN ($1, $2, $3, $4, $5, $6, $7)`,
    'configurationSetting_priceUncovered',
    'configurationSetting_priceCovered',
    'configurationSetting_priceWash',
    'configurationSetting_deliveryFee',
    'configurationSetting_priceIncrementsCovered',
    'configurationSetting_priceIncrementsUncovered',
    'configurationSetting_mandatoryPrePayment'
  );

  const settingsMap = new Map<string, string | null>();
  settings.forEach((s) => settingsMap.set(s.id, s.value));

  const parseFloatOrNull = (value: string | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  };

  const parseJsonArrayOrNull = (value: string | null | undefined): number[] | null => {
    if (value === null || value === undefined || value === '') return null;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((v: any) => typeof v === 'number')) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const parseBoolean = (value: string | null | undefined): boolean => {
    if (value === null || value === undefined || value === '') return false;
    try { return JSON.parse(value) === true; } catch { return false; }
  };

  return {
    priceUncovered: parseFloatOrNull(settingsMap.get('configurationSetting_priceUncovered')),
    priceCovered: parseFloatOrNull(settingsMap.get('configurationSetting_priceCovered')),
    priceWash: parseFloatOrNull(settingsMap.get('configurationSetting_priceWash')),
    deliveryFee: parseFloatOrNull(settingsMap.get('configurationSetting_deliveryFee')),
    priceIncrementsCovered: parseJsonArrayOrNull(settingsMap.get('configurationSetting_priceIncrementsCovered')),
    priceIncrementsUncovered: parseJsonArrayOrNull(settingsMap.get('configurationSetting_priceIncrementsUncovered')),
    mandatoryPrePayment: parseBoolean(settingsMap.get('configurationSetting_mandatoryPrePayment')),
  };
}

function calculateProgressivePrice(basePrice: number, days: number, increments: number[] | null): number {
  let price = basePrice;
  for (let day = 2; day <= days; day++) {
    const incrementIndex = day - 2;
    const increment = increments && increments.length > 0
      ? (incrementIndex < increments.length ? increments[incrementIndex] : increments[increments.length - 1])
      : 0;
    price += increment;
  }
  return price;
}

function calculateExtraFeeProgressive(originalDays: number, extraDays: number, increments: number[] | null): number {
  if (!increments || increments.length === 0) return 0;
  let fee = 0;
  for (let i = 0; i < extraDays; i++) {
    const incrementIndex = originalDays + i - 1;
    const increment = incrementIndex < increments.length ? increments[incrementIndex] : increments[increments.length - 1];
    fee += increment;
  }
  return fee;
}

function hasAirportDelivery(dropOffOption?: string | null, pickUpOption?: string | null): boolean {
  return dropOffOption === 'airport_pickup' || pickUpOption === 'airport_delivery';
}

export async function createGuestBooking(
  params: CreateGuestBookingParams,
): Promise<{ id: string; finalPrice: number | null }> {
  if (params.checkOutDate) {
    const availability = await checkAvailability(
      params.checkInDate,
      params.checkOutDate,
      params.parkingTypeId
    );

    if (!availability.available) {
      throw new Error(availability.message || "No parking spots available for the selected dates");
    }
  }

  const nameParts = params.fullName.trim().split(" ");
  const name = nameParts[0] || "";
  const surname = nameParts.slice(1).join(" ") || "";

  const checkInDate = new Date(params.checkInDate + "T12:00:00Z");
  const checkOutDate = params.checkOutDate ? new Date(params.checkOutDate + "T12:00:00Z") : null;
  const checkInTime = parseTimeToDate(params.checkInTime);
  const checkOutTime = params.checkOutTime ? parseTimeToDate(params.checkOutTime) : null;

  // Calculate final price
  let finalPrice: number | null = null;
  const priceSettings = await getPriceSettings();
  if (checkOutDate) {
    const days = calculateDays(checkInDate, checkOutDate);
    
    let basePrice: number | null = null;
    let increments: number[] | null = null;
    if (params.parkingTypeId === 'parkingType_uncovered') {
      basePrice = priceSettings.priceUncovered;
      increments = priceSettings.priceIncrementsUncovered;
    } else if (params.parkingTypeId === 'parkingType_covered') {
      basePrice = priceSettings.priceCovered;
      increments = priceSettings.priceIncrementsCovered;
    }

    if (basePrice !== null) {
      finalPrice = calculateProgressivePrice(basePrice, days, increments);
      if (params.washService && priceSettings.priceWash !== null) {
        finalPrice += priceSettings.priceWash;
      }
      if (hasAirportDelivery(params.dropOffOption, params.pickUpOption) && priceSettings.deliveryFee !== null) {
        finalPrice += priceSettings.deliveryFee;
      }
    }
  }

  const booking = await prisma.booking.create({
    data: {
      name,
      surname,
      email: params.email,
      mobile: params.phone,
      phoneCodeId: params.phoneCodeId || null,
      plateNo: params.licensePlate,
      carBrand: params.vehicleBrand,
      carModel: params.vehicleModel,
      carColor: params.vehicleColor,
      returnFlight: params.flightNumber || null,
      dateFrom: checkInDate,
      timeFrom: checkInTime,
      dateTo: checkOutDate,
      timeTo: checkOutTime,
      parkingTypeId: params.parkingTypeId,
      washService: params.washService || false,
      finalPrice: finalPrice,
      dropOffOption: params.dropOffOption || null,
      pickUpOption: params.pickUpOption || null,
      deleteflag: 0,
    },
  });

  const parkingType = await prisma.parkingType.findUnique({
    where: { id: params.parkingTypeId },
    select: { name: true },
  });

  if (params.email) {
    console.log(`Sending guest booking confirmation email to: ${params.email}`);
    getEmailDescription().then((emailDescription) => {
      sendBookingConfirmationEmail({
        email: params.email,
        fullName: params.fullName,
        checkInDate: params.checkInDate,
        checkInTime: params.checkInTime,
        checkOutDate: params.checkOutDate || undefined,
        checkOutTime: params.checkOutTime || undefined,
        licensePlate: params.licensePlate,
        vehicleBrand: params.vehicleBrand,
        vehicleModel: params.vehicleModel || undefined,
        vehicleColor: params.vehicleColor || undefined,
        parkingType: parkingType?.name || params.parkingTypeId,
        washService: params.washService || false,
        flightNumber: params.flightNumber || undefined,
        dropOffOption: params.dropOffOption || undefined,
        pickUpOption: params.pickUpOption || undefined,
        finalPrice: finalPrice,
        emailDescription,
        paymentStatus: (!priceSettings.mandatoryPrePayment && finalPrice !== null) ? 'pending' : null,
      }).then((result) => {
        if (result.success) {
          console.log(`Email sent successfully to ${params.email}, messageId: ${result.messageId}`);
        } else {
          console.error(`Failed to send email to ${params.email}: ${result.error}`);
        }
      });
    }).catch((err) => {
      console.error("Failed to send guest booking confirmation email:", err);
    });
  }

  return { id: booking.id, finalPrice };
}

export async function createBooking(
  params: CreateBookingParams,
): Promise<{ id: string; finalPrice: number | null }> {
  if (params.checkOutDate) {
    const availability = await checkAvailability(
      params.checkInDate,
      params.checkOutDate,
      params.parkingTypeId
    );

    if (!availability.available) {
      throw new Error(availability.message || "No parking spots available for the selected dates");
    }
  }

  const nameParts = params.fullName.trim().split(" ");
  const name = nameParts[0] || "";
  const surname = nameParts.slice(1).join(" ") || "";

  const checkInDate = new Date(params.checkInDate + "T12:00:00Z");
  const checkOutDate = params.checkOutDate ? new Date(params.checkOutDate + "T12:00:00Z") : null;
  const checkInTime = parseTimeToDate(params.checkInTime);
  const checkOutTime = params.checkOutTime ? parseTimeToDate(params.checkOutTime) : null;

  let finalPrice: number | null = null;
  if (params.finalPrice !== undefined) {
    finalPrice = params.finalPrice;
  } else if (checkOutDate) {
    const days = calculateDays(checkInDate, checkOutDate);
    const priceSettings = await getPriceSettings();
    
    let basePrice: number | null = null;
    let increments: number[] | null = null;
    if (params.parkingTypeId === 'parkingType_uncovered') {
      basePrice = priceSettings.priceUncovered;
      increments = priceSettings.priceIncrementsUncovered;
    } else if (params.parkingTypeId === 'parkingType_covered') {
      basePrice = priceSettings.priceCovered;
      increments = priceSettings.priceIncrementsCovered;
    }

    if (basePrice !== null) {
      finalPrice = calculateProgressivePrice(basePrice, days, increments);
      if (params.washService && priceSettings.priceWash !== null) {
        finalPrice += priceSettings.priceWash;
      }
      if (hasAirportDelivery(params.dropOffOption, params.pickUpOption) && priceSettings.deliveryFee !== null) {
        finalPrice += priceSettings.deliveryFee;
      }
    }

    if (params.discountPercentage && params.discountPercentage > 0 && finalPrice !== null) {
      finalPrice = Math.round(finalPrice * (1 - params.discountPercentage / 100) * 100) / 100;
    }
  }

  const booking = await prisma.booking.create({
    data: {
      userId: params.userId || null,
      name,
      surname,
      email: params.email,
      mobile: params.phone,
      phoneCodeId: params.phoneCodeId || null,
      plateNo: params.licensePlate,
      carBrand: params.vehicleBrand,
      carModel: params.vehicleModel,
      carColor: params.vehicleColor,
      returnFlight: params.flightNumber || null,
      dateFrom: checkInDate,
      timeFrom: checkInTime,
      dateTo: checkOutDate,
      timeTo: checkOutTime,
      parkingTypeId: params.parkingTypeId,
      washService: params.washService || false,
      finalPrice: finalPrice,
      dropOffOption: params.dropOffOption || null,
      pickUpOption: params.pickUpOption || null,
      deleteflag: 0,
    },
  });

  const parkingType = await prisma.parkingType.findUnique({
    where: { id: params.parkingTypeId },
    select: { name: true },
  });

  if (params.email) {
    console.log(`Sending booking confirmation email to: ${params.email}`);
    getEmailDescription().then((emailDescription) => {
      sendBookingConfirmationEmail({
        email: params.email,
        fullName: params.fullName,
        checkInDate: params.checkInDate,
        checkInTime: params.checkInTime,
        checkOutDate: params.checkOutDate || undefined,
        checkOutTime: params.checkOutTime || undefined,
        licensePlate: params.licensePlate,
        vehicleBrand: params.vehicleBrand,
        vehicleModel: params.vehicleModel,
        vehicleColor: params.vehicleColor,
        parkingType: parkingType?.name || params.parkingTypeId,
        washService: params.washService || false,
        flightNumber: params.flightNumber || undefined,
        dropOffOption: params.dropOffOption || undefined,
        pickUpOption: params.pickUpOption || undefined,
        finalPrice: finalPrice,
        emailDescription,
      }).then((result) => {
        if (result.success) {
          console.log(`Email sent successfully to ${params.email}, messageId: ${result.messageId}`);
        } else {
          console.error(`Failed to send email to ${params.email}: ${result.error}`);
        }
      });
    }).catch((err) => {
      console.error("Failed to send booking confirmation email:", err);
    });
  } else {
    console.log("No email provided, skipping confirmation email");
  }

  return { id: booking.id, finalPrice };
}

export interface UpdateBookingParams {
  fullName?: string;
  email?: string;
  phone?: string;
  phoneCodeId?: string | null;
  licensePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  flightNumber?: string | null;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  parkingTypeId?: string;
  washService?: boolean;
  dropOffOption?: string | null;
  pickUpOption?: string | null;
  userId?: string | null;
  finalPrice?: number | null;
  isRegularUser?: boolean;
}

export async function updateBooking(
  id: string,
  params: UpdateBookingParams,
): Promise<{ id: string; finalPrice: number | null; requiresPayment: boolean; differenceAmount: number } | null> {
  if (!isValidUUID(id)) return null;

  const existingBooking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!existingBooking) return null;

  const checkInDateStr = params.checkInDate || existingBooking.dateFrom.toISOString().split("T")[0];
  const checkOutDateStr = params.checkOutDate !== undefined
    ? (params.checkOutDate || null)
    : (existingBooking.dateTo ? existingBooking.dateTo.toISOString().split("T")[0] : null);
  const parkingTypeIdForCheck = params.parkingTypeId || existingBooking.parkingTypeId;

  if (parkingTypeIdForCheck && checkOutDateStr) {
    const availability = await checkAvailability(
      checkInDateStr,
      checkOutDateStr,
      parkingTypeIdForCheck,
      id
    );

    if (!availability.available) {
      throw new Error(availability.message || "No parking spots available for the selected dates");
    }
  }

  const updateData: Record<string, unknown> = {};

  if (params.fullName !== undefined) {
    const nameParts = params.fullName.trim().split(" ");
    updateData.name = nameParts[0] || "";
    updateData.surname = nameParts.slice(1).join(" ") || "";
  }

  if (params.email !== undefined) updateData.email = params.email;
  if (params.phone !== undefined) updateData.mobile = params.phone;
  if (params.phoneCodeId !== undefined) updateData.phoneCodeId = params.phoneCodeId;
  if (params.licensePlate !== undefined) updateData.plateNo = params.licensePlate;
  if (params.vehicleBrand !== undefined) updateData.carBrand = params.vehicleBrand;
  if (params.vehicleModel !== undefined) updateData.carModel = params.vehicleModel;
  if (params.vehicleColor !== undefined) updateData.carColor = params.vehicleColor;
  if (params.flightNumber !== undefined) updateData.returnFlight = params.flightNumber;
  if (params.dropOffOption !== undefined) updateData.dropOffOption = params.dropOffOption;
  if (params.pickUpOption !== undefined) updateData.pickUpOption = params.pickUpOption;
  if (params.userId !== undefined) updateData.userId = params.userId;
  if (params.washService !== undefined) updateData.washService = params.washService;
  if (params.parkingTypeId !== undefined) updateData.parkingTypeId = params.parkingTypeId;

  if (params.checkInDate !== undefined) {
    updateData.dateFrom = new Date(params.checkInDate + "T12:00:00Z");
  }
  if (params.checkInTime !== undefined) {
    updateData.timeFrom = parseTimeToDate(params.checkInTime);
  }
  if (params.checkOutDate !== undefined) {
    updateData.dateTo = params.checkOutDate ? new Date(params.checkOutDate + "T12:00:00Z") : null;
  }
  if (params.checkOutTime !== undefined) {
    updateData.timeTo = params.checkOutTime ? parseTimeToDate(params.checkOutTime) : null;
  }

  const checkInDate = updateData.dateFrom as Date || existingBooking.dateFrom;
  const checkOutDate = (updateData.dateTo !== undefined ? updateData.dateTo : existingBooking.dateTo) as Date | null;
  const parkingTypeId = (updateData.parkingTypeId as string) || existingBooking.parkingTypeId;
  const washService = (updateData.washService as boolean) ?? existingBooking.washService;
  const dropOffOption = (params.dropOffOption !== undefined ? params.dropOffOption : existingBooking.dropOffOption) as string | null;
  const pickUpOption = (params.pickUpOption !== undefined ? params.pickUpOption : existingBooking.pickUpOption) as string | null;

  let finalPrice: number | null = null;
  if (params.finalPrice !== undefined) {
    finalPrice = params.finalPrice;
  } else if (checkOutDate) {
    const days = calculateDays(checkInDate, checkOutDate);
    const priceSettings = await getPriceSettings();

    let basePrice: number | null = null;
    let increments: number[] | null = null;
    if (parkingTypeId === 'parkingType_uncovered') {
      basePrice = priceSettings.priceUncovered;
      increments = priceSettings.priceIncrementsUncovered;
    } else if (parkingTypeId === 'parkingType_covered') {
      basePrice = priceSettings.priceCovered;
      increments = priceSettings.priceIncrementsCovered;
    }

    if (basePrice !== null) {
      finalPrice = calculateProgressivePrice(basePrice, days, increments);
      if (washService && priceSettings.priceWash !== null) {
        finalPrice += priceSettings.priceWash;
      }
      if (hasAirportDelivery(dropOffOption, pickUpOption) && priceSettings.deliveryFee !== null) {
        finalPrice += priceSettings.deliveryFee;
      }
    }
  }
  updateData.finalPrice = finalPrice;

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: updateData,
  });

  const emailToSend = params.email || existingBooking.email;
  if (emailToSend) {
    const fullName = params.fullName || `${existingBooking.name} ${existingBooking.surname}`.trim();
    const checkInTime = params.checkInTime || (existingBooking.timeFrom ? existingBooking.timeFrom.toISOString().split("T")[1].substring(0, 5) : "12:00");
    const checkOutTime = params.checkOutTime !== undefined ? (params.checkOutTime || null) : (existingBooking.timeTo ? existingBooking.timeTo.toISOString().split("T")[1].substring(0, 5) : null);
    const licensePlate = params.licensePlate || existingBooking.plateNo || "";
    const vehicleBrand = params.vehicleBrand || existingBooking.carBrand || "";
    const vehicleModel = params.vehicleModel || existingBooking.carModel || undefined;
    const vehicleColor = params.vehicleColor || existingBooking.carColor || undefined;
    const flightNumber = params.flightNumber !== undefined ? params.flightNumber : existingBooking.returnFlight;
    const dropOffOption = params.dropOffOption !== undefined ? params.dropOffOption : existingBooking.dropOffOption;
    const pickUpOption = params.pickUpOption !== undefined ? params.pickUpOption : existingBooking.pickUpOption;

    const parkingType = await prisma.parkingType.findUnique({
      where: { id: parkingTypeId || "" },
      select: { name: true },
    });

    console.log(`Sending booking update confirmation email to: ${emailToSend}`);
    getEmailDescription().then((emailDescription) => {
      sendBookingConfirmationEmail({
        email: emailToSend,
        fullName,
        checkInDate: checkInDateStr,
        checkInTime,
        checkOutDate: checkOutDateStr || undefined,
        checkOutTime: checkOutTime || undefined,
        licensePlate,
        vehicleBrand,
        vehicleModel,
        vehicleColor,
        parkingType: parkingType?.name || parkingTypeId || "",
        washService: washService || false,
        flightNumber: flightNumber || undefined,
        dropOffOption: dropOffOption || undefined,
        pickUpOption: pickUpOption || undefined,
        finalPrice,
        isUpdate: true,
        emailDescription,
      }).then((result) => {
        if (result.success) {
          console.log(`Update email sent successfully to ${emailToSend}, messageId: ${result.messageId}`);
        } else {
          console.error(`Failed to send update email to ${emailToSend}: ${result.error}`);
        }
      });
    }).catch((err) => {
      console.error("Failed to send booking update confirmation email:", err);
    });
  }

  let requiresPayment = false;
  let differenceAmount = 0;

  if (params.isRegularUser && finalPrice !== null && finalPrice > 0) {
    const paidResult = await prisma.$queryRawUnsafe<{ total: string }[]>(
      `SELECT COALESCE(SUM(amount), 0)::text as total FROM wallee_transactions WHERE "bookingId" = $1`,
      id
    );
    const paidAmount = parseFloat(paidResult[0]?.total ?? '0');
    if (paidAmount < finalPrice) {
      requiresPayment = true;
      differenceAmount = parseFloat((finalPrice - paidAmount).toFixed(2));
    }
  }

  return { id: updatedBooking.id, finalPrice, requiresPayment, differenceAmount };
}

export interface StageBookingUpdateParams {
  fullName?: string;
  email?: string;
  phone?: string;
  phoneCodeId?: string | null;
  licensePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  flightNumber?: string | null;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  parkingTypeId?: string;
  washService?: boolean;
  dropOffOption?: string | null;
  pickUpOption?: string | null;
  userId?: string | null;
  finalPrice?: number | null;
}

export async function stageBookingUpdate(
  bookingId: string,
  params: StageBookingUpdateParams,
): Promise<{ requiresPayment: false } | { requiresPayment: true; pendingId: string; differenceAmount: number }> {
  if (!isValidUUID(bookingId)) throw new Error('Invalid booking ID');

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.deleteflag !== 0) throw new Error('Booking not found');

  const newFinalPrice = params.finalPrice ?? null;
  if (newFinalPrice === null || newFinalPrice <= 0) {
    return { requiresPayment: false };
  }

  const paidResult = await prisma.$queryRawUnsafe<{ total: string }[]>(
    `SELECT COALESCE(SUM(amount), 0)::text as total FROM wallee_transactions WHERE "bookingId" = $1`,
    bookingId
  );
  const paidAmount = parseFloat(paidResult[0]?.total ?? '0');
  const differenceAmount = parseFloat((newFinalPrice - paidAmount).toFixed(2));

  if (differenceAmount <= 0) {
    return { requiresPayment: false };
  }

  const formData = { bookingId, ...params, differenceAmount };

  const pending = await prisma.pendingBooking.create({
    data: {
      formData: formData as any,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return { requiresPayment: true, pendingId: pending.id, differenceAmount };
}

export interface ParkingTypesResponse {
  parkingTypes: { id: string; name: string; pricePerDay: number | null; priceIncrements: number[] | null }[];
  washAvailable: boolean;
  washPrice: number | null;
  deliveryFee: number | null;
  mandatoryPrePayment: boolean;
  airportDeliveryEnabled: boolean;
  availableAfter: number;
}

export async function getParkingTypes(): Promise<ParkingTypesResponse> {
  const types = await prisma.parkingType.findMany({
    select: { id: true, name: true },
  });

  const settings = await prisma.$queryRawUnsafe<{ id: string; value: string | null }[]>(
    `SELECT id, value FROM configuration_settings WHERE id IN ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    'configurationSetting_availableUncovered',
    'configurationSetting_availableCovered',
    'configurationSetting_priceUncovered',
    'configurationSetting_priceCovered',
    'configurationSetting_priceWash',
    'configurationSetting_deliveryFee',
    'configurationSetting_priceIncrementsCovered',
    'configurationSetting_priceIncrementsUncovered',
    'configurationSetting_mandatoryPrePayment',
    'configurationSetting_delivery',
    'configurationSetting_availableAfter'
  );

  const settingsMap = new Map<string, string | null>();
  settings.forEach((s) => settingsMap.set(s.id, s.value));

  const availableUncovered = parseAvailability(settingsMap.get('configurationSetting_availableUncovered'));
  const availableCovered = parseAvailability(settingsMap.get('configurationSetting_availableCovered'));
  const priceUncovered = parsePrice(settingsMap.get('configurationSetting_priceUncovered'));
  const priceCovered = parsePrice(settingsMap.get('configurationSetting_priceCovered'));
  const priceWash = parsePrice(settingsMap.get('configurationSetting_priceWash'));
  const deliveryFee = parsePrice(settingsMap.get('configurationSetting_deliveryFee'));

  const parseJsonArray = (value: string | null | undefined): number[] | null => {
    if (value === null || value === undefined || value === '') return null;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.every((v: any) => typeof v === 'number')) return parsed;
      return null;
    } catch { return null; }
  };
  const parseBooleanSetting = (value: string | null | undefined): boolean => {
    if (value === null || value === undefined || value === '') return false;
    try { return JSON.parse(value) === true; } catch { return false; }
  };

  const incrementsCovered = parseJsonArray(settingsMap.get('configurationSetting_priceIncrementsCovered'));
  const incrementsUncovered = parseJsonArray(settingsMap.get('configurationSetting_priceIncrementsUncovered'));
  const mandatoryPrePayment = parseBooleanSetting(settingsMap.get('configurationSetting_mandatoryPrePayment'));
  const deliveryRaw = settingsMap.get('configurationSetting_delivery');
  const airportDeliveryEnabled = deliveryRaw !== null && deliveryRaw !== undefined
    ? parseBooleanSetting(deliveryRaw)
    : true;
  const availableAfterRaw = settingsMap.get('configurationSetting_availableAfter');
  const availableAfter = (() => {
    if (availableAfterRaw === null || availableAfterRaw === undefined) return 0;
    const parsed = parseInt(availableAfterRaw, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  })();

  const filteredTypes = types.filter((type) => {
    if (type.id === 'parkingType_uncovered') {
      return availableUncovered !== null && availableUncovered > 0;
    }
    if (type.id === 'parkingType_covered') {
      return availableCovered !== null && availableCovered > 0;
    }
    return true;
  });

  const parkingTypes = filteredTypes.map((type) => ({
    id: type.id,
    name: type.name,
    pricePerDay: type.id === 'parkingType_uncovered' ? priceUncovered : 
                 type.id === 'parkingType_covered' ? priceCovered : null,
    priceIncrements: type.id === 'parkingType_uncovered' ? incrementsUncovered :
                     type.id === 'parkingType_covered' ? incrementsCovered : null,
  }));

  return {
    parkingTypes,
    washAvailable: priceWash !== null,
    washPrice: priceWash,
    deliveryFee,
    mandatoryPrePayment,
    airportDeliveryEnabled,
    availableAfter,
  };
}

function parseAvailability(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function parsePrice(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

export async function getPhoneCodes(): Promise<
  { id: string; isoCode: string; phoneCode: string }[]
> {
  const codes = await prisma.phoneCode.findMany({
    select: { id: true, isoCode: true, phoneCode: true },
    orderBy: { phoneCode: "asc" },
  });
  return codes;
}

export async function getBookingsByUserId(userId: string): Promise<BookingResponse[]> {
  const bookings = await prisma.$queryRawUnsafe<any[]>(`
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
      b."phoneCodeId",
      b."plateNo",
      b."carBrand",
      b."carModel",
      b."carColor",
      b."parkingTypeId",
      pt.name as "parkingTypeName",
      b.adults,
      b."washService",
      b."finalPrice",
      b."dropOffOption",
      b."pickUpOption",
      b."userId",
      b."bookingStatusId",
      bs.value as "bookingStatusValue",
      b."parkPlace",
      b."keepKeys",
      b."mileageKm",
      b."parkingComments",
      b."actualCheckIn",
      b."actualCheckOut",
      b."extraFee",
      b.deleteflag,
      b."checkInBy",
      b."checkOutBy",
      COALESCE((SELECT SUM(wt.amount) FROM wallee_transactions wt WHERE wt."bookingId" = b.id), 0) as "paidAmount",
      b.estimated_arrival_time
    FROM bookings b
    LEFT JOIN parking_types pt ON b."parkingTypeId" = pt.id
    LEFT JOIN booking_statuses bs ON b."bookingStatusId" = bs.id
    WHERE b."userId" = $1 AND b.deleteflag = 0
    ORDER BY b."dateFrom" DESC, COALESCE(b."timeFrom"::time, '00:00:00'::time) DESC
  `, userId);

  return bookings.map((b: any) => ({
    id: b.id,
    name: b.name,
    surname: b.surname,
    email: b.email,
    returnFlight: b.returnFlight,
    dateFrom: formatDate(b.dateFrom)!,
    timeFrom: formatTime(b.timeFrom),
    dateTo: formatDate(b.dateTo),
    timeTo: formatTime(b.timeTo),
    mobile: b.mobile,
    phoneCodeId: b.phoneCodeId || null,
    plateNo: b.plateNo,
    carBrand: b.carBrand,
    carModel: b.carModel,
    carColor: b.carColor,
    parkingType: b.parkingTypeName,
    parkingTypeId: b.parkingTypeId || null,
    adults: b.adults,
    washService: b.washService ?? false,
    finalPrice: b.finalPrice !== null ? parseFloat(b.finalPrice) : null,
    dropOffOption: b.dropOffOption || null,
    pickUpOption: b.pickUpOption || null,
    userId: b.userId || null,
    bookingStatusId: b.bookingStatusId || null,
    bookingStatus: b.bookingStatusValue || null,
    parkPlace: b.parkPlace || null,
    keepKeys: b.keepKeys ?? null,
    mileageKm: b.mileageKm ?? null,
    parkingComments: b.parkingComments || null,
    actualCheckIn: b.actualCheckIn ? b.actualCheckIn.toISOString() : null,
    actualCheckOut: b.actualCheckOut ? b.actualCheckOut.toISOString() : null,
    extraFee: b.extraFee !== null ? parseFloat(b.extraFee) : null,
    deleteflag: b.deleteflag,
    checkInBy: b.checkInBy,
    checkOutBy: b.checkOutBy,
    paidAmount: parseFloat(b.paidAmount ?? '0'),
    paymentStatus: derivePaymentStatus(
      b.finalPrice !== null ? parseFloat(b.finalPrice) : null,
      parseFloat(b.paidAmount ?? '0')
    ),
    isPrepaid: parseFloat(b.paidAmount ?? '0') > 0,
    walleePayment: null,
    estimated_arrival_time: b.estimated_arrival_time
  }));
}

interface ParkExtraFields {
  keepKeys?: boolean;
  mileageKm?: number;
  parkingComments?: string;
  plateNo?: string;
  carModel?: string;
  adults?: number;
}

export async function updateBookingStatus(
  id: string,
  bookingStatusId: string,
  parkPlace?: string,
  applyExtraFee?: boolean,
  extraFields?: ParkExtraFields,
  actorName?: string,
): Promise<{ id: string; bookingStatusId: string; bookingStatus: string; parkPlace?: string; actualCheckIn?: string; actualCheckOut?: string; extraFee?: number } | null> {
  if (!isValidUUID(id)) return null;

  const statusLabels: Record<string, string> = {
    'bookingStatus_created': 'Created',
    'bookingStatus_parked': 'Parked',
    'bookingStatus_completed': 'Completed',
  };

  if (!statusLabels[bookingStatusId]) {
    return null;
  }

  const existingBooking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!existingBooking) return null;

  const updateData: Record<string, any> = {
    bookingStatus: { connect: { id: bookingStatusId } },
  };
  
  if (bookingStatusId === 'bookingStatus_parked' && parkPlace) {
    updateData.parkPlace = parkPlace;
    updateData.actualCheckIn = new Date();
    updateData.checkInBy = actorName || null;
    if (extraFields) {
      if (extraFields.keepKeys !== undefined) updateData.keepKeys = extraFields.keepKeys;
      if (extraFields.mileageKm !== undefined) updateData.mileageKm = extraFields.mileageKm;
      if (extraFields.parkingComments !== undefined) updateData.parkingComments = extraFields.parkingComments;
      if (extraFields.plateNo !== undefined) updateData.plateNo = extraFields.plateNo;
      if (extraFields.carModel !== undefined) updateData.carModel = extraFields.carModel;
      if (extraFields.adults !== undefined) updateData.adults = extraFields.adults;
    }
  }

  if (bookingStatusId === 'bookingStatus_created') {
    updateData.parkPlace = null;
    updateData.actualCheckIn = null;
    updateData.keepKeys = null;
    updateData.mileageKm = null;
    updateData.parkingComments = null;
    updateData.checkInBy = null;
  }

  let calculatedExtraFee: number | undefined = undefined;
  let actualCheckOutDate: Date | undefined = undefined;

  if (bookingStatusId === 'bookingStatus_completed') {
    actualCheckOutDate = new Date();
    updateData.actualCheckOut = actualCheckOutDate;
    updateData.checkOutBy = actorName || null;

    const checkOutDate = existingBooking.dateTo ? new Date(existingBooking.dateTo) : null;
    if (checkOutDate) {
      checkOutDate.setHours(23, 59, 59, 999);
    }

    if (checkOutDate && actualCheckOutDate > checkOutDate && applyExtraFee === true) {
      const actualCheckOutDay = new Date(actualCheckOutDate);
      actualCheckOutDay.setHours(0, 0, 0, 0);
      const checkOutDay = new Date(existingBooking.dateTo!);
      checkOutDay.setHours(0, 0, 0, 0);

      const diffTime = actualCheckOutDay.getTime() - checkOutDay.getTime();
      const extraDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (extraDays > 0 && existingBooking.parkingTypeId) {
        const priceSettings = await getPriceSettings();
        let increments: number[] | null = null;
        
        if (existingBooking.parkingTypeId === 'parkingType_uncovered') {
          increments = priceSettings.priceIncrementsUncovered;
        } else if (existingBooking.parkingTypeId === 'parkingType_covered') {
          increments = priceSettings.priceIncrementsCovered;
        }

        const checkInDate = existingBooking.dateFrom ? new Date(existingBooking.dateFrom) : null;
        if (checkInDate && checkOutDay) {
          const originalDays = calculateDays(checkInDate, checkOutDay);
          calculatedExtraFee = calculateExtraFeeProgressive(originalDays, extraDays, increments);
          updateData.extraFee = calculatedExtraFee;
        }
      }
    } else if (applyExtraFee === false) {
      updateData.extraFee = null;
    }
  }

  await prisma.booking.update({
    where: { id },
    data: updateData,
  });

  return {
    id,
    bookingStatusId,
    bookingStatus: statusLabels[bookingStatusId],
    parkPlace: parkPlace || undefined,
    actualCheckIn: bookingStatusId === 'bookingStatus_parked' && updateData.actualCheckIn instanceof Date ? updateData.actualCheckIn.toISOString() : undefined,
    actualCheckOut: actualCheckOutDate?.toISOString(),
    extraFee: calculatedExtraFee,
  };
}

interface UpdateParkedBookingParams {
  parkPlace?: string;
  pickUpOption?: string | null;
  washService?: boolean;
  flightNumber?: string | null;
  checkOutDate?: string | null;
  checkOutTime?: string | null;
  finalPrice?: number | null;
}

export async function updateParkedBooking(
  id: string,
  params: UpdateParkedBookingParams,
): Promise<{ id: string; parkPlace: string | null; pickUpOption: string | null; washService: boolean; finalPrice: number | null } | null> {
  if (!isValidUUID(id)) return null;

  const existingBooking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!existingBooking) return null;

  if (existingBooking.bookingStatusId !== 'bookingStatus_parked') {
    return null;
  }

  const updateData: Record<string, unknown> = {};
  
  if (params.parkPlace !== undefined) {
    updateData.parkPlace = params.parkPlace;
  }
  
  if (params.pickUpOption !== undefined) {
    updateData.pickUpOption = params.pickUpOption;
  }
  
  if (params.washService !== undefined) {
    updateData.washService = params.washService;
  }

  if (params.flightNumber !== undefined) {
    updateData.returnFlight = params.flightNumber;
  }

  if (params.checkOutDate !== undefined) {
    updateData.dateTo = params.checkOutDate ? new Date(params.checkOutDate + "T12:00:00Z") : null;
  }

  if (params.checkOutTime !== undefined) {
    updateData.timeTo = params.checkOutTime ? parseTimeToDate(params.checkOutTime) : null;
  }

  const checkInDate = existingBooking.dateFrom;
  const checkOutDate = (updateData.dateTo !== undefined ? updateData.dateTo : existingBooking.dateTo) as Date | null;
  const washService = (updateData.washService as boolean) ?? existingBooking.washService;
  const pickUpOption = (params.pickUpOption !== undefined ? params.pickUpOption : existingBooking.pickUpOption) as string | null;
  const dropOffOption = existingBooking.dropOffOption as string | null;

  let finalPrice: number | null = null;
  if (params.finalPrice !== undefined) {
    finalPrice = params.finalPrice;
  } else if (checkOutDate) {
    const parkingTypeId = existingBooking.parkingTypeId;
    const days = calculateDays(checkInDate, checkOutDate);
    const priceSettings = await getPriceSettings();

    let basePrice: number | null = null;
    let increments: number[] | null = null;
    if (parkingTypeId === 'parkingType_uncovered') {
      basePrice = priceSettings.priceUncovered;
      increments = priceSettings.priceIncrementsUncovered;
    } else if (parkingTypeId === 'parkingType_covered') {
      basePrice = priceSettings.priceCovered;
      increments = priceSettings.priceIncrementsCovered;
    }

    if (basePrice !== null) {
      finalPrice = calculateProgressivePrice(basePrice, days, increments);
      if (washService && priceSettings.priceWash !== null) {
        finalPrice += priceSettings.priceWash;
      }
      if (hasAirportDelivery(dropOffOption, pickUpOption) && priceSettings.deliveryFee !== null) {
        finalPrice += priceSettings.deliveryFee;
      }
    }
  }
  updateData.finalPrice = finalPrice;

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: updateData,
  });

  const emailToSend = existingBooking.email;
  if (emailToSend) {
    const fullName = `${existingBooking.name} ${existingBooking.surname}`.trim();
    const checkInDate = existingBooking.dateFrom.toISOString().split("T")[0];
    const checkInTime = existingBooking.timeFrom
      ? existingBooking.timeFrom.toISOString().split("T")[1].substring(0, 5)
      : "12:00";
    const resolvedCheckOutDate = (updateData.dateTo !== undefined ? updateData.dateTo : existingBooking.dateTo) as Date | null;
    const checkOutDateStr = resolvedCheckOutDate ? resolvedCheckOutDate.toISOString().split("T")[0] : undefined;
    const resolvedCheckOutTime = (updateData.timeTo !== undefined ? updateData.timeTo : existingBooking.timeTo) as Date | null;
    const checkOutTimeStr = resolvedCheckOutTime
      ? resolvedCheckOutTime.toISOString().split("T")[1].substring(0, 5)
      : undefined;
    const resolvedFlightNumber = (updateData.returnFlight !== undefined ? updateData.returnFlight : existingBooking.returnFlight) as string | null;
    const resolvedPickUpOption = (updateData.pickUpOption !== undefined ? updateData.pickUpOption : existingBooking.pickUpOption) as string | null;

    const parkingType = existingBooking.parkingTypeId
      ? await prisma.parkingType.findUnique({
          where: { id: existingBooking.parkingTypeId },
          select: { name: true },
        })
      : null;

    console.log(`Sending parked booking update email to: ${emailToSend}`);
    getEmailDescription().then((emailDescription) => {
      sendBookingConfirmationEmail({
        email: emailToSend,
        fullName,
        checkInDate,
        checkInTime,
        checkOutDate: checkOutDateStr,
        checkOutTime: checkOutTimeStr,
        licensePlate: existingBooking.plateNo || "",
        vehicleBrand: existingBooking.carBrand || "",
        vehicleModel: existingBooking.carModel || undefined,
        vehicleColor: existingBooking.carColor || undefined,
        parkingType: parkingType?.name || existingBooking.parkingTypeId || "",
        washService: (updateData.washService as boolean) ?? existingBooking.washService,
        flightNumber: resolvedFlightNumber || undefined,
        dropOffOption: existingBooking.dropOffOption || undefined,
        pickUpOption: resolvedPickUpOption || undefined,
        finalPrice,
        isUpdate: true,
        emailDescription,
      }).then((result) => {
        if (result.success) {
          console.log(`Parked booking update email sent successfully to ${emailToSend}, messageId: ${result.messageId}`);
        } else {
          console.error(`Failed to send parked booking update email to ${emailToSend}: ${result.error}`);
        }
      });
    }).catch((err) => {
      console.error("Failed to send parked booking update email:", err);
    });
  }

  return {
    id: updatedBooking.id,
    parkPlace: updatedBooking.parkPlace,
    pickUpOption: updatedBooking.pickUpOption,
    washService: updatedBooking.washService,
    finalPrice: updatedBooking.finalPrice ? parseFloat(updatedBooking.finalPrice.toString()) : null,
  };
}

export async function checkParkPlaceAvailability(
  parkPlace: string,
  excludeBookingId: string,
): Promise<{ available: boolean }> {
  const existing = await prisma.booking.findFirst({
    where: {
      parkPlace,
      bookingStatusId: 'bookingStatus_parked',
      id: { not: excludeBookingId },
      deleteflag: 0,
    },
  });
  return { available: !existing };
}

export async function estimateExtraFee(
  bookingId: string,
): Promise<{ extraFee: number; isLate: boolean; walleePaymentDate: string | null } | null> {
  if (!isValidUUID(bookingId)) return null;

  const [booking, latestWallee] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId } }),
    prisma.walleeTransaction.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  if (!booking) return null;

  const walleePaymentDate = latestWallee?.createdAt
    ? (latestWallee.createdAt as Date).toISOString()
    : null;

  const checkOutDate = booking.dateTo ? new Date(booking.dateTo) : null;
  if (!checkOutDate) return { extraFee: 0, isLate: false, walleePaymentDate };

  checkOutDate.setHours(23, 59, 59, 999);
  const now = new Date();
  if (now <= checkOutDate) return { extraFee: 0, isLate: false, walleePaymentDate };

  const actualCheckOutDay = new Date(now);
  actualCheckOutDay.setHours(0, 0, 0, 0);
  const checkOutDay = new Date(booking.dateTo!);
  checkOutDay.setHours(0, 0, 0, 0);

  const diffTime = actualCheckOutDay.getTime() - checkOutDay.getTime();
  const extraDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (extraDays <= 0 || !booking.parkingTypeId) return { extraFee: 0, isLate: true, walleePaymentDate };

  const priceSettings = await getPriceSettings();
  let increments: number[] | null = null;
  if (booking.parkingTypeId === 'parkingType_uncovered') {
    increments = priceSettings.priceIncrementsUncovered;
  } else if (booking.parkingTypeId === 'parkingType_covered') {
    increments = priceSettings.priceIncrementsCovered;
  }

  const checkInDate = booking.dateFrom ? new Date(booking.dateFrom) : null;
  if (!checkInDate) return { extraFee: 0, isLate: true, walleePaymentDate };

  const originalDays = calculateDays(checkInDate, checkOutDay);
  const calculatedExtraFee = calculateExtraFeeProgressive(originalDays, extraDays, increments);
  return { extraFee: calculatedExtraFee, isLate: true, walleePaymentDate };
}

export async function completeBooking(
  bookingId: string,
  params: {
    amount: number;
    paymentMethod: string;
    applyExtraFee: boolean;
    actorUserId: string;
    actorName: string;
    notes?: string;
    shiftId?: number | null;
  },
): Promise<{ success: boolean; completionTransactionId: string } | null> {
  if (!isValidUUID(bookingId)) return null;

  let extraFeeToApply: number | null = null;
  if (params.applyExtraFee) {
    const estimate = await estimateExtraFee(bookingId);
    if (estimate && estimate.extraFee > 0) {
      extraFeeToApply = estimate.extraFee;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, any> = {
      bookingStatus: { connect: { id: 'bookingStatus_completed' } },
      actualCheckOut: new Date(),
      checkOutBy: params.actorName || params.actorUserId,
      extraFee: extraFeeToApply,
    };

    await tx.booking.update({ where: { id: bookingId }, data: updateData });

    const completion = await tx.completionTransaction.create({
      data: {
        bookingId,
        amount: params.amount,
        userId: params.actorUserId,
        paymentMethod: params.paymentMethod,
        notes: params.notes || null,
        shiftId: params.shiftId ?? null,
      },
    });

    return completion;
  });

  return { success: true, completionTransactionId: result.id };
}

export async function getCheckinPaymentInfo(
  bookingId: string,
): Promise<{ latestPaymentDate: string | null } | null> {
  if (!isValidUUID(bookingId)) return null;

  const latest = await prisma.walleeTransaction.findFirst({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return {
    latestPaymentDate: latest?.createdAt
      ? (latest.createdAt as Date).toISOString()
      : null,
  };
}

export async function recordCheckinPayment(
  bookingId: string,
  params: {
    amount: number;
    paymentMethod: string;
    actorUserId: string;
    notes?: string;
    shiftId?: number | null;
  },
): Promise<{ success: boolean; id: string } | null> {
  if (!isValidUUID(bookingId)) return null;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.deleteflag !== 0) return null;

  const record = await prisma.checkinTransaction.create({
    data: {
      bookingId,
      amount: params.amount,
      userId: params.actorUserId,
      paymentMethod: params.paymentMethod,
      notes: params.notes || null,
      shiftId: params.shiftId ?? null,
    },
  });

  return { success: true, id: record.id };
}

export { isValidDateFormat, isDateInPast, isValidUUID };
