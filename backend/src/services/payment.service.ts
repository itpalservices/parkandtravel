import { prisma } from '../lib/prisma';
import {
  createWalleeTransaction,
  buildPaymentPageUrl,
  getWalleeTransactionById,
  searchWalleeTransactionsByMerchantRef,
} from './wallee.service';
import { sendBookingConfirmationEmail } from './email.service';
import { createReceipt, ReceiptLineInput } from './receipt.service';
import { generateReceiptPdf } from './pdf.service';
import { uploadPdfToS3 } from './upload.service';

const WALLEE_SUCCESS_STATES = ['AUTHORIZED', 'FULFILL', 'COMPLETED'];
const WALLEE_FAILED_STATES = ['FAILED', 'VOIDED', 'DECLINE', 'DECLINED'];

function getAppDomain(): string {
  if (process.env.PARK_AND_FLY_DOMAIN) {
    return process.env.PARK_AND_FLY_DOMAIN;
  }
  if (process.env.PARK_AND_FLY_DOMAIN) {
    return `https://${process.env.PARK_AND_FLY_DOMAIN}`;
  }
  return 'http://localhost:4200';
}

async function getEmailDescription(): Promise<string | null> {
  const result = await prisma.$queryRawUnsafe<{ value: string | null }[]>(
    `SELECT value FROM configuration_settings WHERE id = $1`,
    'configurationSetting_emailDescription'
  );
  return result[0]?.value ?? null;
}

async function getPriceSettings() {
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

  const m = new Map<string, string | null>();
  settings.forEach((s) => m.set(s.id, s.value));

  const parseFloat_ = (v: string | null | undefined): number | null => {
    if (!v) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const parseJsonArr = (v: string | null | undefined): number[] | null => {
    if (!v) return null;
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : null;
    } catch { return null; }
  };
  const parseBool = (v: string | null | undefined): boolean => {
    if (!v) return false;
    try { return JSON.parse(v) === true; } catch { return false; }
  };

  return {
    priceUncovered: parseFloat_(m.get('configurationSetting_priceUncovered')),
    priceCovered: parseFloat_(m.get('configurationSetting_priceCovered')),
    priceWash: parseFloat_(m.get('configurationSetting_priceWash')),
    deliveryFee: parseFloat_(m.get('configurationSetting_deliveryFee')),
    priceIncrementsCovered: parseJsonArr(m.get('configurationSetting_priceIncrementsCovered')),
    priceIncrementsUncovered: parseJsonArr(m.get('configurationSetting_priceIncrementsUncovered')),
    mandatoryPrePayment: parseBool(m.get('configurationSetting_mandatoryPrePayment')),
  };
}

function calcDays(from: Date, to: Date): number {
  return Math.max(Math.ceil((to.getTime() - from.getTime()) / 86400000), 1);
}

function calcProgressive(base: number, days: number, increments: number[] | null): number {
  let price = base;
  for (let d = 2; d <= days; d++) {
    const idx = d - 2;
    const inc = increments && increments.length > 0
      ? (idx < increments.length ? increments[idx] : increments[increments.length - 1])
      : 0;
    price += inc;
  }
  return price;
}

function hasAirportDelivery(drop?: string | null, pick?: string | null): boolean {
  return drop === 'airport_pickup' || pick === 'airport_delivery';
}

function parseTimeToDate(t: string): Date {
  const [h, min] = t.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, min, 0));
}

function parseName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts.pop()! : parts[0];
  const name = parts.join(' ') || surname;
  return { name, surname };
}

interface GuestFormData {
  fullName: string;
  email: string;
  phone: string;
  phoneCodeId?: string | null;
  licensePlate: string;
  vehicleBrand: string;
  vehicleModel?: string;
  vehicleColor?: string;
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

interface AuthPendingFormData {
  fullName: string;
  email: string;
  phone: string;
  phoneCodeId?: string | null;
  licensePlate: string;
  vehicleBrand: string;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  flightNumber?: string | null;
  checkInDate: string;
  checkInTime: string;
  checkOutDate?: string | null;
  checkOutTime?: string | null;
  parkingTypeId: string;
  washService?: boolean;
  dropOffOption?: string | null;
  pickUpOption?: string | null;
  userId?: string | null;
  finalPrice: number;
  discountPercentage?: number | null;
}

async function calculateFinalPrice(
  formData: GuestFormData,
  priceSettings: Awaited<ReturnType<typeof getPriceSettings>>
): Promise<number | null> {
  if (!formData.checkOutDate) return null;

  const checkInDate = new Date(formData.checkInDate);
  const checkOutDate = new Date(formData.checkOutDate);
  const days = calcDays(checkInDate, checkOutDate);

  let base: number | null = null;
  let increments: number[] | null = null;
  if (formData.parkingTypeId === 'parkingType_uncovered') {
    base = priceSettings.priceUncovered;
    increments = priceSettings.priceIncrementsUncovered;
  } else if (formData.parkingTypeId === 'parkingType_covered') {
    base = priceSettings.priceCovered;
    increments = priceSettings.priceIncrementsCovered;
  }

  if (base === null) return null;

  let price = calcProgressive(base, days, increments);
  if (formData.washService && priceSettings.priceWash !== null) {
    price += priceSettings.priceWash;
  }
  if (hasAirportDelivery(formData.dropOffOption, formData.pickUpOption) && priceSettings.deliveryFee !== null) {
    price += priceSettings.deliveryFee;
  }
  return price;
}

type PriceSettingsSnapshot = Awaited<ReturnType<typeof getPriceSettings>>;

interface BookingPricingState {
  dateFrom: Date;
  dateTo: Date | null;
  parkingTypeId: string | null;
  washService: boolean;
  dropOffOption: string | null;
  pickUpOption: string | null;
}

function buildGuardingAmount(state: BookingPricingState, ps: PriceSettingsSnapshot): number {
  if (!state.dateTo) return 0;
  const days = calcDays(state.dateFrom, state.dateTo);
  let base: number | null = null;
  let increments: number[] | null = null;
  if (state.parkingTypeId === 'parkingType_uncovered') {
    base = ps.priceUncovered;
    increments = ps.priceIncrementsUncovered;
  } else if (state.parkingTypeId === 'parkingType_covered') {
    base = ps.priceCovered;
    increments = ps.priceIncrementsCovered;
  }
  if (base === null) return 0;
  return parseFloat(calcProgressive(base, days, increments).toFixed(2));
}

function buildLinesForNewBooking(state: BookingPricingState, ps: PriceSettingsSnapshot): ReceiptLineInput[] {
  const lines: ReceiptLineInput[] = [];

  const guardingAmount = buildGuardingAmount(state, ps);
  if (guardingAmount > 0 && state.dateTo) {
    const days = calcDays(state.dateFrom, state.dateTo);
    lines.push({
      lineType: 'GUARDING',
      description: `Parking for ${days} day${days !== 1 ? 's' : ''}`,
      amount: guardingAmount,
    });
  }

  if (state.washService && ps.priceWash !== null && ps.priceWash > 0) {
    lines.push({ lineType: 'WASHING', description: 'Car wash service', amount: ps.priceWash });
  }

  if (hasAirportDelivery(state.dropOffOption, state.pickUpOption) && ps.deliveryFee !== null && ps.deliveryFee > 0) {
    lines.push({ lineType: 'DELIVERY', description: 'Airport delivery', amount: ps.deliveryFee });
  }

  return lines;
}

function buildLinesForBookingUpdate(
  oldState: BookingPricingState,
  newState: BookingPricingState,
  ps: PriceSettingsSnapshot,
  alreadyChargedTypes: Set<string>,
): ReceiptLineInput[] {
  const lines: ReceiptLineInput[] = [];

  const guardingDiff = parseFloat((buildGuardingAmount(newState, ps) - buildGuardingAmount(oldState, ps)).toFixed(2));
  if (guardingDiff > 0 && newState.dateTo) {
    const days = calcDays(newState.dateFrom, newState.dateTo);
    lines.push({
      lineType: 'GUARDING',
      description: `Additional parking (${days} day${days !== 1 ? 's' : ''} total)`,
      amount: guardingDiff,
    });
  }

  if (!alreadyChargedTypes.has('WASHING') && newState.washService && ps.priceWash !== null && ps.priceWash > 0) {
    lines.push({ lineType: 'WASHING', description: 'Car wash service', amount: ps.priceWash });
  }

  if (
    !alreadyChargedTypes.has('DELIVERY') &&
    hasAirportDelivery(newState.dropOffOption, newState.pickUpOption) &&
    ps.deliveryFee !== null && ps.deliveryFee > 0
  ) {
    lines.push({ lineType: 'DELIVERY', description: 'Airport delivery', amount: ps.deliveryFee });
  }

  return lines;
}

async function createBookingFromPending(
  pending: { id: string; wlTransactionId: bigint | null; formData: any },
  wlTransactionId: number
): Promise<string> {
  const formData = pending.formData as GuestFormData & { processedBookingId?: string };

  if (formData.processedBookingId) {
    return formData.processedBookingId;
  }

  const { name, surname } = parseName(formData.fullName);
  const checkInDate = new Date(formData.checkInDate);
  const checkOutDate = formData.checkOutDate ? new Date(formData.checkOutDate) : null;
  const checkInTime = formData.checkInTime ? parseTimeToDate(formData.checkInTime) : null;
  const checkOutTime = formData.checkOutTime ? parseTimeToDate(formData.checkOutTime) : null;

  const priceSettings = await getPriceSettings();
  const finalPrice = await calculateFinalPrice(formData, priceSettings);

  const booking = await prisma.booking.create({
    data: {
      name,
      surname,
      email: formData.email,
      mobile: formData.phone,
      phoneCodeId: formData.phoneCodeId || null,
      plateNo: formData.licensePlate,
      carBrand: formData.vehicleBrand,
      carModel: formData.vehicleModel || null,
      carColor: formData.vehicleColor || null,
      returnFlight: formData.flightNumber || null,
      dateFrom: checkInDate,
      timeFrom: checkInTime,
      dateTo: checkOutDate,
      timeTo: checkOutTime,
      parkingTypeId: formData.parkingTypeId,
      washService: formData.washService || false,
      finalPrice: finalPrice,
      dropOffOption: formData.dropOffOption || null,
      pickUpOption: formData.pickUpOption || null,
      deleteflag: 0,
    },
  });

  let pdfBuffer: Buffer | undefined;

  if (finalPrice !== null) {
    await prisma.walleeTransaction.create({
      data: {
        id: BigInt(wlTransactionId),
        amount: finalPrice,
        bookingId: booking.id,
      },
    }).catch((err) => console.error('Failed to record wallee_transaction for pending booking:', err));

    const receiptLines = buildLinesForNewBooking(
      {
        dateFrom: checkInDate,
        dateTo: checkOutDate,
        parkingTypeId: formData.parkingTypeId,
        washService: formData.washService || false,
        dropOffOption: formData.dropOffOption || null,
        pickUpOption: formData.pickUpOption || null,
      },
      priceSettings,
    );

    const receipt = await createReceipt({ bookingId: booking.id, transactionId: wlTransactionId, lines: receiptLines })
      .catch((err) => { console.error('Failed to create receipt for pending booking:', err); return null; });

    if (receipt) {
      try {
        pdfBuffer = await generateReceiptPdf({
          receiptNumber: receipt.receiptNumber,
          receiptDate: receipt.createdAt,
          bookingId: booking.id,
          customerName: `${name} ${surname}`.trim(),
          totalAmount: receipt.totalAmount,
          discount: receipt.discount,
          lines: receipt.lines,
        });
        const s3Key = await uploadPdfToS3(booking.id, pdfBuffer, receipt.receiptNumber);
        await prisma.receiptHeader.update({ where: { id: receipt.id }, data: { pdfKey: s3Key } });
      } catch (err) {
        console.error('Failed to generate/upload receipt PDF for pending booking:', err);
        pdfBuffer = undefined;
      }
    }
  }

  const updatedFormData = { ...formData, processedBookingId: booking.id };
  await prisma.pendingBooking.update({
    where: { id: pending.id },
    data: { formData: updatedFormData },
  });

  const parkingType = await prisma.parkingType.findUnique({
    where: { id: formData.parkingTypeId },
    select: { name: true },
  });

  if (formData.email) {
    const emailDescription = await getEmailDescription();
    sendBookingConfirmationEmail({
      email: formData.email,
      fullName: formData.fullName,
      checkInDate: formData.checkInDate,
      checkInTime: formData.checkInTime,
      checkOutDate: formData.checkOutDate || undefined,
      checkOutTime: formData.checkOutTime || undefined,
      licensePlate: formData.licensePlate,
      vehicleBrand: formData.vehicleBrand,
      vehicleModel: formData.vehicleModel || undefined,
      vehicleColor: formData.vehicleColor || undefined,
      parkingType: parkingType?.name || formData.parkingTypeId,
      washService: formData.washService || false,
      flightNumber: formData.flightNumber || undefined,
      dropOffOption: formData.dropOffOption || undefined,
      pickUpOption: formData.pickUpOption || undefined,
      finalPrice,
      emailDescription,
      paymentStatus: 'paid',
      receiptPdfBuffer: pdfBuffer,
    }).catch((err) => console.error('Failed to send payment confirmation email:', err));
  }

  return booking.id;
}

async function createBookingFromAuthPending(
  pending: { id: string; wlTransactionId: bigint | null; formData: any },
  wlTransactionId: number
): Promise<string> {
  const formData = pending.formData as AuthPendingFormData & { processedBookingId?: string };

  if (formData.processedBookingId) {
    return formData.processedBookingId;
  }

  const { name, surname } = parseName(formData.fullName);
  const checkInDate = new Date(formData.checkInDate + 'T12:00:00Z');
  const checkOutDate = formData.checkOutDate ? new Date(formData.checkOutDate + 'T12:00:00Z') : null;
  const checkInTime = formData.checkInTime ? parseTimeToDate(formData.checkInTime) : null;
  const checkOutTime = formData.checkOutTime ? parseTimeToDate(formData.checkOutTime) : null;
  const finalPrice = formData.finalPrice;

  const booking = await prisma.booking.create({
    data: {
      userId: formData.userId || null,
      name,
      surname,
      email: formData.email,
      mobile: formData.phone,
      phoneCodeId: formData.phoneCodeId || null,
      plateNo: formData.licensePlate,
      carBrand: formData.vehicleBrand,
      carModel: formData.vehicleModel || null,
      carColor: formData.vehicleColor || null,
      returnFlight: formData.flightNumber || null,
      dateFrom: checkInDate,
      timeFrom: checkInTime,
      dateTo: checkOutDate,
      timeTo: checkOutTime,
      parkingTypeId: formData.parkingTypeId,
      washService: formData.washService || false,
      finalPrice,
      dropOffOption: formData.dropOffOption || null,
      pickUpOption: formData.pickUpOption || null,
      deleteflag: 0,
    },
  });

  await prisma.walleeTransaction.create({
    data: {
      id: BigInt(wlTransactionId),
      amount: finalPrice,
      bookingId: booking.id,
    },
  }).catch((err) => console.error('Failed to record wallee_transaction for auth_pending booking:', err));

  const authPriceSettings = await getPriceSettings();
  const authReceiptLines = buildLinesForNewBooking(
    {
      dateFrom: checkInDate,
      dateTo: checkOutDate,
      parkingTypeId: formData.parkingTypeId,
      washService: formData.washService || false,
      dropOffOption: formData.dropOffOption || null,
      pickUpOption: formData.pickUpOption || null,
    },
    authPriceSettings,
  );

  let authPdfBuffer: Buffer | undefined;
  const authReceipt = await createReceipt({ bookingId: booking.id, transactionId: wlTransactionId, lines: authReceiptLines, discountPercentage: formData.discountPercentage ?? null })
    .catch((err) => { console.error('Failed to create receipt for auth_pending booking:', err); return null; });

  if (authReceipt) {
    try {
      authPdfBuffer = await generateReceiptPdf({
        receiptNumber: authReceipt.receiptNumber,
        receiptDate: authReceipt.createdAt,
        bookingId: booking.id,
        customerName: `${name} ${surname}`.trim(),
        totalAmount: authReceipt.totalAmount,
        discount: authReceipt.discount,
        lines: authReceipt.lines,
      });
      const s3Key = await uploadPdfToS3(booking.id, authPdfBuffer, authReceipt.receiptNumber);
      await prisma.receiptHeader.update({ where: { id: authReceipt.id }, data: { pdfKey: s3Key } });
    } catch (err) {
      console.error('Failed to generate/upload receipt PDF for auth_pending booking:', err);
      authPdfBuffer = undefined;
    }
  }

  const updatedFormData = { ...formData, processedBookingId: booking.id };
  await prisma.pendingBooking.update({
    where: { id: pending.id },
    data: { formData: updatedFormData },
  });

  const parkingType = await prisma.parkingType.findUnique({
    where: { id: formData.parkingTypeId },
    select: { name: true },
  });

  if (formData.email) {
    const emailDescription = await getEmailDescription();
    sendBookingConfirmationEmail({
      email: formData.email,
      fullName: formData.fullName,
      checkInDate: formData.checkInDate,
      checkInTime: formData.checkInTime,
      checkOutDate: formData.checkOutDate || undefined,
      checkOutTime: formData.checkOutTime || undefined,
      licensePlate: formData.licensePlate,
      vehicleBrand: formData.vehicleBrand,
      vehicleModel: formData.vehicleModel || undefined,
      vehicleColor: formData.vehicleColor || undefined,
      parkingType: parkingType?.name || formData.parkingTypeId,
      washService: formData.washService || false,
      flightNumber: formData.flightNumber || undefined,
      dropOffOption: formData.dropOffOption || undefined,
      pickUpOption: formData.pickUpOption || undefined,
      finalPrice,
      emailDescription,
      paymentStatus: 'paid',
      receiptPdfBuffer: authPdfBuffer,
    }).catch((err) => console.error('Failed to send auth_pending booking confirmation email:', err));
  }

  return booking.id;
}

export async function initiatePaymentForPending(formData: GuestFormData): Promise<{ paymentUrl: string }> {
  const priceSettings = await getPriceSettings();
  const finalPrice = await calculateFinalPrice(formData, priceSettings);

  if (finalPrice === null) {
    throw new Error('Cannot process payment without return date and calculated price. Please fill in the return details.');
  }

  const pending = await prisma.pendingBooking.create({
    data: {
      formData: formData as any,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const domain = getAppDomain();
  const merchantReference = `pending_${pending.id}`;

  const transactionId = await createWalleeTransaction({
    merchantReference,
    amount: finalPrice,
    currency: 'EUR',
    customerEmail: formData.email,
    fullName: formData.fullName,
    description: 'Parking Reservation - Park & Travel',
    successUrl: `${domain}/payment/success?ref=${merchantReference}`,
    failedUrl: `${domain}/payment/failed?ref=${merchantReference}`,
    plateNo: formData.licensePlate,
    carBrand: formData.vehicleBrand,
  });

  await prisma.pendingBooking.update({
    where: { id: pending.id },
    data: { wlTransactionId: BigInt(transactionId) },
  });

  const paymentUrl = await buildPaymentPageUrl(transactionId);
  return { paymentUrl };
}

export async function initiatePaymentForAuthPending(formData: AuthPendingFormData, userId: string): Promise<{ paymentUrl: string }> {
  const finalPrice = formData.finalPrice;
  if (!finalPrice || finalPrice <= 0) {
    throw new Error('Cannot process payment without a calculated price.');
  }

  const dataWithUser = { ...formData, userId };

  const pending = await prisma.pendingBooking.create({
    data: {
      formData: dataWithUser as any,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const domain = getAppDomain();
  const merchantReference = `auth_pending_${pending.id}`;

  const transactionId = await createWalleeTransaction({
    merchantReference,
    amount: finalPrice,
    currency: 'EUR',
    customerEmail: formData.email || undefined,
    fullName: formData.fullName,
    description: 'Parking Reservation - Park & Travel',
    successUrl: `${domain}/payment/success?ref=${merchantReference}&source=auth_pending`,
    failedUrl: `${domain}/payment/failed?ref=${merchantReference}&source=auth_pending`,
    plateNo: formData.licensePlate,
    carBrand: formData.vehicleBrand,
  });

  await prisma.pendingBooking.update({
    where: { id: pending.id },
    data: { wlTransactionId: BigInt(transactionId) },
  });

  const paymentUrl = await buildPaymentPageUrl(transactionId);
  return { paymentUrl };
}

export async function initiatePaymentForBooking(bookingId: string, source?: string, customAmount?: number): Promise<{ paymentUrl: string }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');
  if (booking.deleteflag !== 0) throw new Error('Booking not found');

  const finalPrice = booking.finalPrice ? Number(booking.finalPrice) : null;
  if (finalPrice === null && customAmount === undefined) {
    throw new Error('Cannot process payment: no price calculated for this booking.');
  }

  const amount = customAmount !== undefined ? customAmount : finalPrice!;

  const domain = getAppDomain();
  const merchantReference = `booking_${bookingId}`;

  const transactionId = await createWalleeTransaction({
    merchantReference,
    amount,
    currency: 'EUR',
    customerEmail: booking.email || undefined,
    fullName: `${booking.name} ${booking.surname}`.trim(),
    description: 'Parking Reservation - Park & Travel',
    successUrl: `${domain}/payment/success?ref=${merchantReference}${source ? `&source=${source}` : ''}`,
    failedUrl: `${domain}/payment/failed?ref=${merchantReference}${source ? `&source=${source}` : ''}`,
    plateNo: booking.plateNo || undefined,
    carBrand: booking.carBrand || undefined,
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { pendingWlTransactionId: BigInt(transactionId) },
  });

  const paymentUrl = await buildPaymentPageUrl(transactionId);
  return { paymentUrl };
}

export async function initiatePaymentForPendingUpdate(pendingId: string, amount: number): Promise<{ paymentUrl: string }> {
  const pending = await prisma.pendingBooking.findUnique({ where: { id: pendingId } });
  if (!pending) throw new Error('Pending update not found');

  const formData = pending.formData as any;
  const bookingId = formData.bookingId as string;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');

  const domain = getAppDomain();
  const merchantReference = `update_${pendingId}`;

  const transactionId = await createWalleeTransaction({
    merchantReference,
    amount,
    currency: 'EUR',
    customerEmail: formData.email || booking.email || undefined,
    fullName: formData.fullName || `${booking.name} ${booking.surname}`.trim(),
    description: 'Parking Reservation Update - Park & Travel',
    successUrl: `${domain}/payment/success?ref=${merchantReference}&source=auth_update`,
    failedUrl: `${domain}/payment/failed?ref=${merchantReference}&source=auth_update`,
    plateNo: formData.licensePlate || booking.plateNo || undefined,
    carBrand: formData.vehicleBrand || booking.carBrand || undefined,
  });

  await prisma.pendingBooking.update({
    where: { id: pendingId },
    data: { wlTransactionId: BigInt(transactionId) },
  });

  const paymentUrl = await buildPaymentPageUrl(transactionId);
  return { paymentUrl };
}

async function applyPendingBookingUpdate(pending: { id: string; formData: any }, wlTransactionId: number): Promise<string> {
  const formData = pending.formData as any;
  const bookingId = formData.bookingId as string;
  const differenceAmount = formData.differenceAmount as number;
  const newFinalPrice = formData.finalPrice as number | null;

  if (formData.processedBookingId) {
    return formData.processedBookingId;
  }

  const oldBooking = await prisma.booking.findUnique({ where: { id: bookingId } });

  const updateData: Record<string, unknown> = {};
  if (formData.fullName !== undefined) {
    const parts = String(formData.fullName).trim().split(' ');
    updateData.name = parts[0] || '';
    updateData.surname = parts.slice(1).join(' ') || '';
  }
  if (formData.email !== undefined) updateData.email = formData.email;
  if (formData.phone !== undefined) updateData.mobile = formData.phone;
  if (formData.phoneCodeId !== undefined) updateData.phoneCodeId = formData.phoneCodeId;
  if (formData.licensePlate !== undefined) updateData.plateNo = formData.licensePlate;
  if (formData.vehicleBrand !== undefined) updateData.carBrand = formData.vehicleBrand;
  if (formData.vehicleModel !== undefined) updateData.carModel = formData.vehicleModel;
  if (formData.vehicleColor !== undefined) updateData.carColor = formData.vehicleColor;
  if (formData.flightNumber !== undefined) updateData.returnFlight = formData.flightNumber;
  if (formData.dropOffOption !== undefined) updateData.dropOffOption = formData.dropOffOption;
  if (formData.pickUpOption !== undefined) updateData.pickUpOption = formData.pickUpOption;
  if (formData.washService !== undefined) updateData.washService = formData.washService;
  if (formData.parkingTypeId !== undefined) updateData.parkingTypeId = formData.parkingTypeId;
  if (formData.checkInDate !== undefined) updateData.dateFrom = new Date(formData.checkInDate + 'T12:00:00Z');
  if (formData.checkInTime !== undefined) updateData.timeFrom = parseTimeToDate(formData.checkInTime);
  if (formData.checkOutDate !== undefined) updateData.dateTo = formData.checkOutDate ? new Date(formData.checkOutDate + 'T12:00:00Z') : null;
  if (formData.checkOutTime !== undefined) updateData.timeTo = formData.checkOutTime ? parseTimeToDate(formData.checkOutTime) : null;
  if (newFinalPrice !== undefined) updateData.finalPrice = newFinalPrice;

  await prisma.booking.update({ where: { id: bookingId }, data: updateData });

  const existing = await prisma.walleeTransaction.findUnique({ where: { id: BigInt(wlTransactionId) } });
  if (!existing) {
    await prisma.walleeTransaction.create({
      data: {
        id: BigInt(wlTransactionId),
        amount: differenceAmount,
        bookingId,
      },
    }).catch((err) => console.error('Failed to record wallee_transaction for pending update:', err));

    if (oldBooking) {
      const updatePriceSettings = await getPriceSettings();

      const existingReceiptLines = await prisma.receiptLine.findMany({
        where: { receipt: { bookingId } },
        select: { lineType: true },
      });
      const alreadyChargedTypes = new Set(existingReceiptLines.map((l) => l.lineType));

      const oldState: BookingPricingState = {
        dateFrom: oldBooking.dateFrom,
        dateTo: oldBooking.dateTo,
        parkingTypeId: oldBooking.parkingTypeId,
        washService: oldBooking.washService,
        dropOffOption: oldBooking.dropOffOption as string | null,
        pickUpOption: oldBooking.pickUpOption as string | null,
      };
      const newState: BookingPricingState = {
        dateFrom: formData.checkInDate ? new Date(formData.checkInDate + 'T12:00:00Z') : oldBooking.dateFrom,
        dateTo: formData.checkOutDate !== undefined
          ? (formData.checkOutDate ? new Date(formData.checkOutDate + 'T12:00:00Z') : null)
          : oldBooking.dateTo,
        parkingTypeId: formData.parkingTypeId ?? oldBooking.parkingTypeId,
        washService: formData.washService !== undefined ? formData.washService : oldBooking.washService,
        dropOffOption: formData.dropOffOption !== undefined ? formData.dropOffOption : (oldBooking.dropOffOption as string | null),
        pickUpOption: formData.pickUpOption !== undefined ? formData.pickUpOption : (oldBooking.pickUpOption as string | null),
      };
      const updateReceiptLines = buildLinesForBookingUpdate(oldState, newState, updatePriceSettings, alreadyChargedTypes);

      const updateReceipt = await createReceipt({ bookingId, transactionId: wlTransactionId, lines: updateReceiptLines, discountPercentage: formData.discountPercentage ?? null })
        .catch((err) => { console.error('Failed to create receipt for pending update:', err); return null; });

      if (updateReceipt) {
        try {
          const updatedBookingForPdf = await prisma.booking.findUnique({ where: { id: bookingId }, select: { name: true, surname: true } });
          const customerName = updatedBookingForPdf
            ? `${updatedBookingForPdf.name} ${updatedBookingForPdf.surname}`.trim()
            : bookingId;
          const updatePdfBuffer = await generateReceiptPdf({
            receiptNumber: updateReceipt.receiptNumber,
            receiptDate: updateReceipt.createdAt,
            bookingId,
            customerName,
            totalAmount: updateReceipt.totalAmount,
            discount: updateReceipt.discount,
            lines: updateReceipt.lines,
          });
          const s3Key = await uploadPdfToS3(bookingId, updatePdfBuffer, updateReceipt.receiptNumber);
          await prisma.receiptHeader.update({ where: { id: updateReceipt.id }, data: { pdfKey: s3Key } });
          await sendPaidConfirmationEmailForBooking(bookingId, updatePdfBuffer);
          return bookingId;
        } catch (err) {
          console.error('Failed to generate/upload receipt PDF for pending update:', err);
        }
      }
    }
  }

  await sendPaidConfirmationEmailForBooking(bookingId);

  await prisma.pendingBooking.update({
    where: { id: pending.id },
    data: { formData: { ...formData, processedBookingId: bookingId } },
  }).catch(() => {});

  return bookingId;
}

async function handlePendingPaymentSuccess(merchantReference: string, wlTransactionId: number): Promise<void> {
  const pendingId = merchantReference.replace('pending_', '');
  const pending = await prisma.pendingBooking.findUnique({ where: { id: pendingId } });
  if (!pending) {
    console.log(`Webhook: pending booking ${pendingId} not found (already processed)`);
    return;
  }

  try {
    await createBookingFromPending(pending, wlTransactionId);
    console.log(`Webhook: booking created from pending ${pendingId}`);
  } catch (err) {
    console.error(`Webhook: error creating booking from pending ${pendingId}:`, err);
  }
}

async function handlePendingUpdatePaymentSuccess(merchantReference: string, wlTransactionId: number): Promise<void> {
  const pendingId = merchantReference.replace('update_', '');
  const pending = await prisma.pendingBooking.findUnique({ where: { id: pendingId } });
  if (!pending) {
    console.log(`Webhook: pending update ${pendingId} not found (already processed)`);
    return;
  }

  try {
    const bookingId = await applyPendingBookingUpdate(pending, wlTransactionId);
    console.log(`Webhook: booking ${bookingId} updated from pending update ${pendingId}`);
  } catch (err) {
    console.error(`Webhook: error applying pending update ${pendingId}:`, err);
  }
}

async function sendPaidConfirmationEmailForBooking(bookingId: string, receiptPdfBuffer?: Buffer): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !booking.email) return;

  const parkingType = await prisma.parkingType.findUnique({
    where: { id: booking.parkingTypeId || '' },
    select: { name: true },
  });
  const emailDescription = await getEmailDescription();

  const checkInDate = booking.dateFrom.toISOString().split('T')[0];
  const checkInTime = booking.timeFrom
    ? booking.timeFrom.toISOString().split('T')[1].substring(0, 5)
    : '00:00';
  const checkOutDate = booking.dateTo ? booking.dateTo.toISOString().split('T')[0] : undefined;
  const checkOutTime = booking.timeTo
    ? booking.timeTo.toISOString().split('T')[1].substring(0, 5)
    : undefined;

  if (!booking.email) return;
  sendBookingConfirmationEmail({
    email: booking.email,
    fullName: `${booking.name} ${booking.surname}`.trim(),
    checkInDate,
    checkInTime,
    checkOutDate,
    checkOutTime,
    licensePlate: booking.plateNo || '',
    vehicleBrand: booking.carBrand || '',
    vehicleModel: booking.carModel || undefined,
    vehicleColor: booking.carColor || undefined,
    parkingType: parkingType?.name || booking.parkingTypeId || '',
    washService: booking.washService || false,
    flightNumber: booking.returnFlight || undefined,
    dropOffOption: booking.dropOffOption || undefined,
    pickUpOption: booking.pickUpOption || undefined,
    finalPrice: booking.finalPrice ? Number(booking.finalPrice) : null,
    emailDescription,
    paymentStatus: 'paid',
    isPaymentConfirmation: true,
    receiptPdfBuffer,
  }).catch((err) => console.error('Failed to send paid confirmation email:', err));
}

async function handleAuthPendingPaymentSuccess(merchantReference: string, wlTransactionId: number): Promise<void> {
  const pendingId = merchantReference.replace('auth_pending_', '');
  const pending = await prisma.pendingBooking.findUnique({ where: { id: pendingId } });
  if (!pending) {
    console.log(`Webhook: auth_pending booking ${pendingId} not found (already processed)`);
    return;
  }

  try {
    const bookingId = await createBookingFromAuthPending(pending, wlTransactionId);
    console.log(`Webhook: booking ${bookingId} created from auth_pending ${pendingId}`);
  } catch (err) {
    console.error(`Webhook: error creating booking from auth_pending ${pendingId}:`, err);
  }
}

async function handleBookingPaymentSuccess(merchantReference: string, wlTransactionId: number): Promise<void> {
  const bookingId = merchantReference.replace('booking_', '');

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    console.log(`Webhook: booking ${bookingId} not found`);
    return;
  }

  const existing = await prisma.walleeTransaction.findUnique({ where: { id: BigInt(wlTransactionId) } });
  if (existing) {
    console.log(`Webhook: wallee transaction ${wlTransactionId} already recorded, skipping`);
    return;
  }

  const amount = booking.finalPrice ? Number(booking.finalPrice) : 0;
  await prisma.walleeTransaction.create({
    data: {
      id: BigInt(wlTransactionId),
      amount,
      bookingId,
    },
  });
  console.log(`Webhook: wallee_transaction ${wlTransactionId} recorded for booking ${bookingId}`);

  await sendPaidConfirmationEmailForBooking(bookingId);
}

export async function handleWalleeWebhook(body: any): Promise<void> {
  const entityId = body.entityId || body.entity_id || body.id;
  if (!entityId) {
    console.log('Webhook: no entityId in body:', JSON.stringify(body));
    return;
  }

  console.log(`Webhook received for entity ${entityId}`);

  const transaction = await getWalleeTransactionById(Number(entityId));
  const state: string = transaction.state;
  const merchantReference: string = transaction.merchantReference || '';

  console.log(`Webhook: transaction ${entityId} state=${state} ref=${merchantReference}`);

  if (WALLEE_SUCCESS_STATES.includes(state)) {
    if (merchantReference.startsWith('auth_pending_')) {
      await handleAuthPendingPaymentSuccess(merchantReference, Number(entityId));
    } else if (merchantReference.startsWith('pending_')) {
      await handlePendingPaymentSuccess(merchantReference, Number(entityId));
    } else if (merchantReference.startsWith('update_')) {
      await handlePendingUpdatePaymentSuccess(merchantReference, Number(entityId));
    } else if (merchantReference.startsWith('booking_')) {
      await handleBookingPaymentSuccess(merchantReference, Number(entityId));
    }
  }
}

export async function verifyAndFinalizePayment(ref: string): Promise<{
  status: 'success' | 'failed' | 'pending';
  bookingId?: string;
  message?: string;
}> {
  if (ref.startsWith('auth_pending_')) {
    const pendingId = ref.replace('auth_pending_', '');
    const pending = await prisma.pendingBooking.findUnique({ where: { id: pendingId } });

    if (!pending) {
      return { status: 'failed', message: 'Booking session not found or expired.' };
    }

    const formData = pending.formData as any;
    if (formData.processedBookingId) {
      await prisma.pendingBooking.delete({ where: { id: pendingId } }).catch(() => {});
      return { status: 'success', bookingId: formData.processedBookingId };
    }

    if (!pending.wlTransactionId) {
      return { status: 'pending', message: 'Payment not yet initiated.' };
    }

    let transaction: any;
    try {
      transaction = await getWalleeTransactionById(Number(pending.wlTransactionId));
    } catch (err) {
      console.error(`verify auth_pending: failed to fetch Wallee transaction:`, err);
      return { status: 'pending', message: 'Could not verify payment status. Please try again.' };
    }

    const state: string = transaction.state;

    if (WALLEE_SUCCESS_STATES.includes(state)) {
      const bookingId = await createBookingFromAuthPending(pending, Number(pending.wlTransactionId));
      await prisma.pendingBooking.delete({ where: { id: pendingId } }).catch(() => {});
      return { status: 'success', bookingId };
    } else if (WALLEE_FAILED_STATES.includes(state)) {
      return { status: 'failed', message: 'Payment was declined. Your booking was not created.' };
    } else {
      return { status: 'pending', message: 'Payment is still processing. Please wait.' };
    }
  } else if (ref.startsWith('update_')) {
    const pendingId = ref.replace('update_', '');
    const pending = await prisma.pendingBooking.findUnique({ where: { id: pendingId } });

    if (!pending) {
      return { status: 'failed', message: 'Update session not found or expired.' };
    }

    const formData = pending.formData as any;
    if (formData.processedBookingId) {
      await prisma.pendingBooking.delete({ where: { id: pendingId } }).catch(() => {});
      return { status: 'success', bookingId: formData.processedBookingId };
    }

    if (!pending.wlTransactionId) {
      return { status: 'pending', message: 'Payment not yet initiated.' };
    }

    let transaction: any;
    try {
      transaction = await getWalleeTransactionById(Number(pending.wlTransactionId));
    } catch (err) {
      console.error(`verify update: failed to fetch Wallee transaction:`, err);
      return { status: 'pending', message: 'Could not verify payment status. Please try again.' };
    }

    const state: string = transaction.state;

    if (WALLEE_SUCCESS_STATES.includes(state)) {
      const bookingId = await applyPendingBookingUpdate(pending, Number(pending.wlTransactionId));
      await prisma.pendingBooking.delete({ where: { id: pendingId } }).catch(() => {});
      return { status: 'success', bookingId };
    } else if (WALLEE_FAILED_STATES.includes(state)) {
      return { status: 'failed', message: 'Payment was declined. Please try again.' };
    } else {
      return { status: 'pending', message: 'Payment is still processing. Please wait.' };
    }
  } else if (ref.startsWith('pending_')) {
    const pendingId = ref.replace('pending_', '');
    const pending = await prisma.pendingBooking.findUnique({ where: { id: pendingId } });

    if (!pending) {
      return { status: 'failed', message: 'Reservation session not found or expired.' };
    }

    const formData = pending.formData as any;
    if (formData.processedBookingId) {
      await prisma.pendingBooking.delete({ where: { id: pendingId } }).catch(() => {});
      return { status: 'success', bookingId: formData.processedBookingId };
    }

    if (!pending.wlTransactionId) {
      return { status: 'pending', message: 'Payment not yet initiated.' };
    }

    const transaction = await getWalleeTransactionById(Number(pending.wlTransactionId));
    const state: string = transaction.state;

    if (WALLEE_SUCCESS_STATES.includes(state)) {
      const bookingId = await createBookingFromPending(pending, Number(pending.wlTransactionId));
      await prisma.pendingBooking.delete({ where: { id: pendingId } }).catch(() => {});
      return { status: 'success', bookingId };
    } else if (WALLEE_FAILED_STATES.includes(state)) {
      return { status: 'failed', message: 'Payment was declined. Please try again.' };
    } else {
      return { status: 'pending', message: 'Payment is still processing. Please wait.' };
    }
  } else if (ref.startsWith('booking_')) {
    const bookingId = ref.replace('booking_', '');
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.deleteflag !== 0) {
      return { status: 'failed', message: 'Booking not found.' };
    }

    const finalPrice = booking.finalPrice ? Number(booking.finalPrice) : null;

    const paidResult = await prisma.$queryRawUnsafe<{ total: string }[]>(
      `SELECT COALESCE(SUM(amount), 0)::text as total FROM wallee_transactions WHERE "bookingId" = $1`,
      bookingId
    );
    const paidAmount = parseFloat(paidResult[0]?.total ?? '0');

    if (finalPrice !== null && paidAmount >= finalPrice) {
      return { status: 'success', bookingId };
    }

    const wlTxId = booking.pendingWlTransactionId;
    if (!wlTxId) {
      console.log(`verify: no pendingWlTransactionId on booking ${bookingId}`);
      return { status: 'pending', message: 'Payment not yet initiated.' };
    }

    let transaction: any;
    try {
      transaction = await getWalleeTransactionById(Number(wlTxId));
    } catch (err) {
      console.error(`verify: failed to fetch Wallee transaction ${wlTxId}:`, err);
      return { status: 'pending', message: 'Could not verify payment status. Please try again.' };
    }

    const state: string = transaction.state;
    console.log(`verify: booking ${bookingId} wlTxId=${wlTxId} state=${state}`);

    if (WALLEE_SUCCESS_STATES.includes(state)) {
      const existing = await prisma.walleeTransaction.findUnique({ where: { id: BigInt(wlTxId) } });
      if (!existing) {
        const amount = transaction.authorizationAmount
          ? Number(transaction.authorizationAmount)
          : (finalPrice ?? 0);
        await prisma.walleeTransaction.create({
          data: { id: BigInt(wlTxId), amount, bookingId },
        }).catch((err) => console.error('Failed to record wallee_transaction on verify:', err));

        await sendPaidConfirmationEmailForBooking(bookingId);
      }
      return { status: 'success', bookingId };
    }

    if (WALLEE_FAILED_STATES.includes(state)) {
      return { status: 'failed', message: 'Payment was declined. Please try again.' };
    }

    return { status: 'pending', message: 'Payment is still processing. Please wait.' };
  }

  return { status: 'failed', message: 'Invalid payment reference.' };
}
