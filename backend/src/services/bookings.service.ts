import { prisma } from "../lib/prisma";

interface GetBookingsParams {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page: number;
  limit: number;
  userId?: string;
}

interface BookingResponse {
  id: string;
  name: string;
  surname: string;
  email: string | null;
  returnFlight: string | null;
  dateFrom: string;
  timeFrom: string | null;
  dateTo: string;
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
  actualCheckOut: string | null;
  extraFee: number | null;
  deleteflag: number;
}

function formatDate(date: Date): string {
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
  const { dateFrom, dateTo, search, page, limit, userId } = params;

  const whereConditions: string[] = [
    `b.deleteflag = 0`,
  ];

  if (userId) {
    whereConditions.push(`b."userId" = '${userId}'`);
  }

  if (dateFrom && dateTo) {
    whereConditions.push(
      `((b."dateFrom" >= '${dateFrom}'::date AND b."dateFrom" <= '${dateTo}'::date) OR (b."dateTo" >= '${dateFrom}'::date AND b."dateTo" <= '${dateTo}'::date))`,
    );
  } else if (dateFrom) {
    whereConditions.push(
      `(b."dateFrom" >= '${dateFrom}'::date OR b."dateTo" >= '${dateFrom}'::date)`,
    );
  } else if (dateTo) {
    whereConditions.push(
      `(b."dateFrom" <= '${dateTo}'::date OR b."dateTo" <= '${dateTo}'::date)`,
    );
  }

  if (search) {
    const searchLower = search.toLowerCase().replace(/'/g, "''");
    whereConditions.push(
      `(LOWER(b.name) LIKE '%${searchLower}%' OR LOWER(b.surname) LIKE '%${searchLower}%' OR LOWER(b.email) LIKE '%${searchLower}%' OR LOWER(b."plateNo") LIKE '%${searchLower}%')`,
    );
  }

  let whereClause = whereConditions.join(" AND ");

  if (dateFrom) {
    whereClause += ` OR (b."bookingStatusId" = 'bookingStatus_parked' AND b."dateTo" < '${dateFrom}'::date AND b.deleteflag = 0)`;
  }

  if (dateFrom && dateTo) {
    whereClause += ` OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date >= '${dateFrom}'::date AND b."actualCheckOut"::date <= '${dateTo}'::date AND b.deleteflag = 0)`;
  } else if (dateFrom) {
    whereClause += ` OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date >= '${dateFrom}'::date AND b.deleteflag = 0)`;
  } else if (dateTo) {
    whereClause += ` OR (b."actualCheckOut" IS NOT NULL AND b."actualCheckOut"::date <= '${dateTo}'::date AND b.deleteflag = 0)`;
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
      b."actualCheckOut",
      b."extraFee"
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
    dateFrom: formatDate(b.dateFrom),
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
    actualCheckOut: b.actualCheckOut ? b.actualCheckOut.toISOString() : null,
    extraFee: b.extraFee !== null ? parseFloat(b.extraFee) : null,
    deleteflag: b.deleteflag,
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
      b."actualCheckOut",
      b."extraFee",
      b.deleteflag
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
    dateFrom: formatDate(b.dateFrom),
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
    actualCheckOut: b.actualCheckOut ? b.actualCheckOut.toISOString() : null,
    extraFee: b.extraFee !== null ? parseFloat(b.extraFee) : null,
    deleteflag: b.deleteflag,
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
  checkOutDate: string;
  checkOutTime: string;
  parkingTypeId: string;
  washService?: boolean;
  dropOffOption?: string | null;
  pickUpOption?: string | null;
}

export interface CreateBookingParams extends CreateGuestBookingParams {
  userId?: string | null;
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
}> {
  const settings = await prisma.$queryRawUnsafe<{ id: string; value: string | null }[]>(
    `SELECT id, value FROM configuration_settings WHERE id IN ($1, $2, $3)`,
    'configurationSetting_priceUncovered',
    'configurationSetting_priceCovered',
    'configurationSetting_priceWash'
  );

  const settingsMap = new Map<string, string | null>();
  settings.forEach((s) => settingsMap.set(s.id, s.value));

  const parseFloatOrNull = (value: string | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  };

  return {
    priceUncovered: parseFloatOrNull(settingsMap.get('configurationSetting_priceUncovered')),
    priceCovered: parseFloatOrNull(settingsMap.get('configurationSetting_priceCovered')),
    priceWash: parseFloatOrNull(settingsMap.get('configurationSetting_priceWash')),
  };
}

export async function createGuestBooking(
  params: CreateGuestBookingParams,
): Promise<{ id: string; finalPrice: number | null }> {
  const nameParts = params.fullName.trim().split(" ");
  const name = nameParts[0] || "";
  const surname = nameParts.slice(1).join(" ") || "";

  const checkInDate = new Date(params.checkInDate + "T12:00:00Z");
  const checkOutDate = new Date(params.checkOutDate + "T12:00:00Z");
  const checkInTime = parseTimeToDate(params.checkInTime);
  const checkOutTime = parseTimeToDate(params.checkOutTime);

  // Calculate final price
  const days = calculateDays(checkInDate, checkOutDate);
  const priceSettings = await getPriceSettings();
  
  let parkingPricePerDay: number | null = null;
  if (params.parkingTypeId === 'parkingType_uncovered') {
    parkingPricePerDay = priceSettings.priceUncovered;
  } else if (params.parkingTypeId === 'parkingType_covered') {
    parkingPricePerDay = priceSettings.priceCovered;
  }

  let finalPrice: number | null = null;
  if (parkingPricePerDay !== null) {
    finalPrice = days * parkingPricePerDay;
    if (params.washService && priceSettings.priceWash !== null) {
      finalPrice += priceSettings.priceWash;
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

  return { id: booking.id, finalPrice };
}

export async function createBooking(
  params: CreateBookingParams,
): Promise<{ id: string; finalPrice: number | null }> {
  const nameParts = params.fullName.trim().split(" ");
  const name = nameParts[0] || "";
  const surname = nameParts.slice(1).join(" ") || "";

  const checkInDate = new Date(params.checkInDate + "T12:00:00Z");
  const checkOutDate = new Date(params.checkOutDate + "T12:00:00Z");
  const checkInTime = parseTimeToDate(params.checkInTime);
  const checkOutTime = parseTimeToDate(params.checkOutTime);

  const days = calculateDays(checkInDate, checkOutDate);
  const priceSettings = await getPriceSettings();
  
  let parkingPricePerDay: number | null = null;
  if (params.parkingTypeId === 'parkingType_uncovered') {
    parkingPricePerDay = priceSettings.priceUncovered;
  } else if (params.parkingTypeId === 'parkingType_covered') {
    parkingPricePerDay = priceSettings.priceCovered;
  }

  let finalPrice: number | null = null;
  if (parkingPricePerDay !== null) {
    finalPrice = days * parkingPricePerDay;
    if (params.washService && priceSettings.priceWash !== null) {
      finalPrice += priceSettings.priceWash;
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
}

export async function updateBooking(
  id: string,
  params: UpdateBookingParams,
): Promise<{ id: string; finalPrice: number | null } | null> {
  if (!isValidUUID(id)) return null;

  const existingBooking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!existingBooking) return null;

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
    updateData.dateTo = new Date(params.checkOutDate + "T12:00:00Z");
  }
  if (params.checkOutTime !== undefined) {
    updateData.timeTo = parseTimeToDate(params.checkOutTime);
  }

  const checkInDate = updateData.dateFrom as Date || existingBooking.dateFrom;
  const checkOutDate = updateData.dateTo as Date || existingBooking.dateTo;
  const parkingTypeId = (updateData.parkingTypeId as string) || existingBooking.parkingTypeId;
  const washService = (updateData.washService as boolean) ?? existingBooking.washService;

  const days = calculateDays(checkInDate, checkOutDate);
  const priceSettings = await getPriceSettings();

  let parkingPricePerDay: number | null = null;
  if (parkingTypeId === 'parkingType_uncovered') {
    parkingPricePerDay = priceSettings.priceUncovered;
  } else if (parkingTypeId === 'parkingType_covered') {
    parkingPricePerDay = priceSettings.priceCovered;
  }

  let finalPrice: number | null = null;
  if (parkingPricePerDay !== null) {
    finalPrice = days * parkingPricePerDay;
    if (washService && priceSettings.priceWash !== null) {
      finalPrice += priceSettings.priceWash;
    }
  }
  updateData.finalPrice = finalPrice;

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: updateData,
  });

  return { id: updatedBooking.id, finalPrice };
}

export interface ParkingTypesResponse {
  parkingTypes: { id: string; name: string; pricePerDay: number | null }[];
  washAvailable: boolean;
  washPrice: number | null;
}

export async function getParkingTypes(): Promise<ParkingTypesResponse> {
  const types = await prisma.parkingType.findMany({
    select: { id: true, name: true },
  });

  // Get availability settings to filter parking types
  const settings = await prisma.$queryRawUnsafe<{ id: string; value: string | null }[]>(
    `SELECT id, value FROM configuration_settings WHERE id IN ($1, $2, $3, $4, $5)`,
    'configurationSetting_availableUncovered',
    'configurationSetting_availableCovered',
    'configurationSetting_priceUncovered',
    'configurationSetting_priceCovered',
    'configurationSetting_priceWash'
  );

  const settingsMap = new Map<string, string | null>();
  settings.forEach((s) => settingsMap.set(s.id, s.value));

  const availableUncovered = parseAvailability(settingsMap.get('configurationSetting_availableUncovered'));
  const availableCovered = parseAvailability(settingsMap.get('configurationSetting_availableCovered'));
  const priceUncovered = parsePrice(settingsMap.get('configurationSetting_priceUncovered'));
  const priceCovered = parsePrice(settingsMap.get('configurationSetting_priceCovered'));
  const priceWash = parsePrice(settingsMap.get('configurationSetting_priceWash'));

  // Filter types based on availability
  const filteredTypes = types.filter((type) => {
    if (type.id === 'parkingType_uncovered') {
      return availableUncovered !== null && availableUncovered > 0;
    }
    if (type.id === 'parkingType_covered') {
      return availableCovered !== null && availableCovered > 0;
    }
    return true;
  });

  // Add price per day to each type
  const parkingTypes = filteredTypes.map((type) => ({
    id: type.id,
    name: type.name,
    pricePerDay: type.id === 'parkingType_uncovered' ? priceUncovered : 
                 type.id === 'parkingType_covered' ? priceCovered : null,
  }));

  return {
    parkingTypes,
    washAvailable: priceWash !== null,
    washPrice: priceWash,
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
      b."actualCheckOut",
      b."extraFee",
      b.deleteflag
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
    dateFrom: formatDate(b.dateFrom),
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
    actualCheckOut: b.actualCheckOut ? b.actualCheckOut.toISOString() : null,
    extraFee: b.extraFee !== null ? parseFloat(b.extraFee) : null,
    deleteflag: b.deleteflag,
  }));
}

export async function updateBookingStatus(
  id: string,
  bookingStatusId: string,
  parkPlace?: string,
  applyExtraFee?: boolean,
): Promise<{ id: string; bookingStatusId: string; bookingStatus: string; parkPlace?: string; actualCheckOut?: string; extraFee?: number } | null> {
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

  const updateData: { bookingStatusId: string; parkPlace?: string | null; actualCheckOut?: Date; extraFee?: number | null } = { bookingStatusId };
  
  if (bookingStatusId === 'bookingStatus_parked' && parkPlace) {
    updateData.parkPlace = parkPlace;
  }

  if (bookingStatusId === 'bookingStatus_created') {
    updateData.parkPlace = null;
  }

  let calculatedExtraFee: number | undefined = undefined;
  let actualCheckOutDate: Date | undefined = undefined;

  if (bookingStatusId === 'bookingStatus_completed') {
    actualCheckOutDate = new Date();
    updateData.actualCheckOut = actualCheckOutDate;

    const checkOutDate = new Date(existingBooking.dateTo);
    checkOutDate.setHours(23, 59, 59, 999);

    if (actualCheckOutDate > checkOutDate && applyExtraFee === true) {
      const actualCheckOutDay = new Date(actualCheckOutDate);
      actualCheckOutDay.setHours(0, 0, 0, 0);
      const checkOutDay = new Date(existingBooking.dateTo);
      checkOutDay.setHours(0, 0, 0, 0);

      const diffTime = actualCheckOutDay.getTime() - checkOutDay.getTime();
      const extraDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (extraDays > 0 && existingBooking.parkingTypeId) {
        const priceSettings = await getPriceSettings();
        let pricePerDay: number | null = null;
        
        if (existingBooking.parkingTypeId === 'parkingType_uncovered') {
          pricePerDay = priceSettings.priceUncovered;
        } else if (existingBooking.parkingTypeId === 'parkingType_covered') {
          pricePerDay = priceSettings.priceCovered;
        }

        if (pricePerDay !== null) {
          calculatedExtraFee = extraDays * pricePerDay;
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
    actualCheckOut: actualCheckOutDate?.toISOString(),
    extraFee: calculatedExtraFee,
  };
}

interface UpdateParkedBookingParams {
  parkPlace?: string;
  pickUpOption?: string;
}

export async function updateParkedBooking(
  id: string,
  params: UpdateParkedBookingParams,
): Promise<{ id: string; parkPlace: string | null; pickUpOption: string | null } | null> {
  if (!isValidUUID(id)) return null;

  const existingBooking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!existingBooking) return null;

  if (existingBooking.bookingStatusId !== 'bookingStatus_parked') {
    return null;
  }

  const updateData: { parkPlace?: string; pickUpOption?: string } = {};
  
  if (params.parkPlace !== undefined) {
    updateData.parkPlace = params.parkPlace;
  }
  
  if (params.pickUpOption !== undefined) {
    updateData.pickUpOption = params.pickUpOption;
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: updateData,
  });

  return {
    id: updatedBooking.id,
    parkPlace: updatedBooking.parkPlace,
    pickUpOption: updatedBooking.pickUpOption,
  };
}

export { isValidDateFormat, isDateInPast, isValidUUID };
