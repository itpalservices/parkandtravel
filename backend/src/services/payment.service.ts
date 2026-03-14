import { prisma } from '../lib/prisma';
import {
  createWalleeTransaction,
  buildPaymentPageUrl,
  getWalleeTransactionById,
} from './wallee.service';
import { sendBookingConfirmationEmail } from './email.service';

const WALLEE_SUCCESS_STATES = ['AUTHORIZED', 'FULFILL', 'COMPLETED'];
const WALLEE_FAILED_STATES = ['FAILED', 'VOIDED', 'DECLINE', 'DECLINED'];

function getAppDomain(): string {
  return (
    process.env.PARK_AND_FLY_DOMAIN ||
    'http://localhost:4200'
  );
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
      wlTransactionId: BigInt(wlTransactionId),
      paymentStatus: 'paid',
    },
  });

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
      paymentPending: false,
    }).catch((err) => console.error('Failed to send payment confirmation email:', err));
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
  });

  await prisma.pendingBooking.update({
    where: { id: pending.id },
    data: { wlTransactionId: BigInt(transactionId) },
  });

  const paymentUrl = await buildPaymentPageUrl(transactionId);
  return { paymentUrl };
}

export async function initiatePaymentForBooking(bookingId: string): Promise<{ paymentUrl: string }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');
  if (booking.deleteflag !== 0) throw new Error('Booking not found');

  const finalPrice = booking.finalPrice ? Number(booking.finalPrice) : null;
  if (finalPrice === null) {
    throw new Error('Cannot process payment: no price calculated for this booking.');
  }

  const domain = getAppDomain();
  const merchantReference = `booking_${bookingId}`;

  const transactionId = await createWalleeTransaction({
    merchantReference,
    amount: finalPrice,
    currency: 'EUR',
    customerEmail: booking.email || undefined,
    fullName: `${booking.name} ${booking.surname}`.trim(),
    description: 'Parking Reservation - Park & Travel',
    successUrl: `${domain}/payment/success?ref=${merchantReference}`,
    failedUrl: `${domain}/payment/failed?ref=${merchantReference}`,
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { wlTransactionId: BigInt(transactionId) },
  });

  const paymentUrl = await buildPaymentPageUrl(transactionId);
  return { paymentUrl };
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

async function handleBookingPaymentSuccess(merchantReference: string, wlTransactionId: number): Promise<void> {
  const bookingId = merchantReference.replace('booking_', '');
  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: 'paid' },
  });
  console.log(`Webhook: booking ${bookingId} marked as paid`);
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
    if (merchantReference.startsWith('pending_')) {
      await handlePendingPaymentSuccess(merchantReference, Number(entityId));
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
  if (ref.startsWith('pending_')) {
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

    if (booking.paymentStatus === 'paid') {
      return { status: 'success', bookingId };
    }

    if (!booking.wlTransactionId) {
      return { status: 'pending', message: 'No payment initiated for this booking.' };
    }

    const transaction = await getWalleeTransactionById(Number(booking.wlTransactionId));
    const state: string = transaction.state;

    if (WALLEE_SUCCESS_STATES.includes(state)) {
      await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: 'paid' } });
      return { status: 'success', bookingId };
    } else if (WALLEE_FAILED_STATES.includes(state)) {
      return { status: 'failed', message: 'Payment was declined. Please try again.' };
    } else {
      return { status: 'pending', message: 'Payment is still processing. Please wait.' };
    }
  }

  return { status: 'failed', message: 'Invalid payment reference.' };
}
