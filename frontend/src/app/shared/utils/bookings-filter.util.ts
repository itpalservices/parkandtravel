import { Booking, BookingSortDirection, BookingSortField, BookingsFilterState } from '../models/booking.model';

/** Case-insensitive "starts with" — the agreed rule for every free-text filter field. */
export function matchesPrefix(value: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (!value) return false;
  return value.toLowerCase().startsWith(q);
}

export function createDefaultBookingsFilterState(
  dateFrom: string | null,
  dateTo: string | null,
  datePreset: string | null = 'today',
): BookingsFilterState {
  return {
    dateFrom,
    dateTo,
    datePreset,
    status: [],
    parkingType: [],
    washService: [],
    dropOff: [],
    pickUp: [],
    source: [],
    priceMin: null,
    priceMax: null,
    checkInBy: '',
    checkOutBy: '',
    name: '',
    email: '',
    mobile: '',
    plateNo: '',
    carBrand: '',
    carModel: '',
    carColor: '',
    returnFlight: '',
    sortField: null,
    sortDirection: 'asc',
  };
}

/** Builds a single predicate from every non-date filter (the date range already narrowed the fetch). */
export function buildBookingsPredicate(state: BookingsFilterState): (booking: Booking) => boolean {
  return (b: Booking): boolean => {
    if (state.status.length > 0 && (!b.bookingStatusId || !state.status.includes(b.bookingStatusId))) return false;
    if (state.parkingType.length > 0 && (!b.parkingTypeId || !state.parkingType.includes(b.parkingTypeId))) return false;
    if (state.washService.length > 0 && !state.washService.includes(b.washService ? 'yes' : 'no')) return false;
    if (state.dropOff.length > 0 && (!b.dropOffOption || !state.dropOff.includes(b.dropOffOption))) return false;
    if (state.pickUp.length > 0 && (!b.pickUpOption || !state.pickUp.includes(b.pickUpOption))) return false;
    if (state.source.length > 0 && !state.source.includes(b.userId ? 'registered' : 'guest')) return false;
    if (state.priceMin !== null && (b.finalPrice === null || b.finalPrice < state.priceMin)) return false;
    if (state.priceMax !== null && (b.finalPrice === null || b.finalPrice > state.priceMax)) return false;
    if (state.checkInBy.trim() && b.checkInBy !== state.checkInBy) return false;
    if (state.checkOutBy.trim() && b.checkOutBy !== state.checkOutBy) return false;
    // Full name matches on either first or last name, not only the concatenated string.
    if (state.name.trim() && !(matchesPrefix(b.name, state.name) || matchesPrefix(b.surname, state.name))) return false;
    if (!matchesPrefix(b.email, state.email)) return false;
    if (!matchesPrefix(b.mobile, state.mobile)) return false;
    if (!matchesPrefix(b.plateNo, state.plateNo)) return false;
    if (!matchesPrefix(b.carBrand, state.carBrand)) return false;
    if (!matchesPrefix(b.carModel, state.carModel)) return false;
    if (!matchesPrefix(b.carColor, state.carColor)) return false;
    if (!matchesPrefix(b.returnFlight, state.returnFlight)) return false;
    return true;
  };
}

/** How many of the panel's fields are active — excludes the date range, which is shown separately. */
export function countActiveFilters(state: BookingsFilterState): number {
  let count = 0;
  if (state.status.length) count++;
  if (state.parkingType.length) count++;
  if (state.washService.length) count++;
  if (state.dropOff.length) count++;
  if (state.pickUp.length) count++;
  if (state.source.length) count++;
  if (state.priceMin !== null || state.priceMax !== null) count++;
  if (state.checkInBy.trim()) count++;
  if (state.checkOutBy.trim()) count++;
  if (state.name.trim()) count++;
  if (state.email.trim()) count++;
  if (state.mobile.trim()) count++;
  if (state.plateNo.trim()) count++;
  if (state.carBrand.trim()) count++;
  if (state.carModel.trim()) count++;
  if (state.carColor.trim()) count++;
  if (state.returnFlight.trim()) count++;
  return count;
}

function vehicleKey(b: Booking): string | null {
  const parts = [b.carBrand, b.carModel].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function checkInKey(b: Booking): string | null {
  if (!b.dateFrom) return null;
  return `${b.dateFrom} ${b.timeFrom ?? '00:00'}`;
}

function checkOutKey(b: Booking): string | null {
  // Mirrors what the table actually displays: the real checkout time once recorded, otherwise the scheduled one.
  if (b.actualCheckOut) return b.actualCheckOut;
  if (!b.dateTo) return null;
  return `${b.dateTo} ${b.timeTo ?? '00:00'}`;
}

/** String compare with nulls always sorting last, regardless of direction. */
function compareStrings(a: string | null, b: string | null, direction: BookingSortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
}

/** Number compare with nulls (e.g. TBC prices) always sorting last, regardless of direction. */
function compareNumbers(a: number | null, b: number | null, direction: BookingSortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = a - b;
  return direction === 'desc' ? -result : result;
}

function compareBooleans(a: boolean, b: boolean, direction: BookingSortDirection): number {
  const result = Number(a) - Number(b);
  return direction === 'desc' ? -result : result;
}

function fieldComparator(field: BookingSortField, direction: BookingSortDirection): (a: Booking, b: Booking) => number {
  switch (field) {
    case 'status': return (a, b) => compareStrings(a.bookingStatus, b.bookingStatus, direction);
    case 'name': return (a, b) => compareStrings(`${a.name} ${a.surname}`, `${b.name} ${b.surname}`, direction);
    case 'plateNo': return (a, b) => compareStrings(a.plateNo, b.plateNo, direction);
    case 'vehicle': return (a, b) => compareStrings(vehicleKey(a), vehicleKey(b), direction);
    case 'carColor': return (a, b) => compareStrings(a.carColor, b.carColor, direction);
    case 'checkIn': return (a, b) => compareStrings(checkInKey(a), checkInKey(b), direction);
    case 'checkInBy': return (a, b) => compareStrings(a.checkInBy, b.checkInBy, direction);
    case 'dropOff': return (a, b) => compareStrings(a.dropOffOption, b.dropOffOption, direction);
    case 'checkOut': return (a, b) => compareStrings(checkOutKey(a), checkOutKey(b), direction);
    case 'checkOutBy': return (a, b) => compareStrings(a.checkOutBy, b.checkOutBy, direction);
    case 'pickUp': return (a, b) => compareStrings(a.pickUpOption, b.pickUpOption, direction);
    case 'returnFlight': return (a, b) => compareStrings(a.returnFlight, b.returnFlight, direction);
    case 'parkingType': return (a, b) => compareStrings(a.parkingType ?? null, b.parkingType ?? null, direction);
    case 'washService': return (a, b) => compareBooleans(a.washService, b.washService, direction);
    case 'source': return (a, b) => compareBooleans(!!a.userId, !!b.userId, direction);
    case 'finalPrice': return (a, b) => compareNumbers(a.finalPrice, b.finalPrice, direction);
  }
}

/** No-op (returns the input order) when `field` is null — matches the backend's own default ordering. */
export function sortBookings(bookings: Booking[], field: BookingSortField | null, direction: BookingSortDirection): Booking[] {
  if (!field) return bookings;
  return [...bookings].sort(fieldComparator(field, direction));
}

// ---------- URL query-param (de)serialization ----------

const PARKING_TYPE_URL_MAP: Record<string, string> = {
  parkingType_covered: 'covered',
  parkingType_uncovered: 'uncovered',
};
const PARKING_TYPE_URL_MAP_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(PARKING_TYPE_URL_MAP).map(([id, short]) => [short, id]),
);
const STATUS_URL_MAP: Record<string, string> = {
  bookingStatus_created: 'created',
  bookingStatus_parked: 'parked',
  bookingStatus_completed: 'completed',
};
const STATUS_URL_MAP_INVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_URL_MAP).map(([id, short]) => [short, id]),
);

export function filterStateToQueryParams(state: BookingsFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (state.dateFrom) params['from'] = state.dateFrom;
  if (state.dateTo) params['to'] = state.dateTo;
  if (state.datePreset) params['preset'] = state.datePreset;
  if (state.status.length) params['status'] = state.status.map((s) => STATUS_URL_MAP[s] ?? s).join(',');
  if (state.parkingType.length) params['parkingType'] = state.parkingType.map((p) => PARKING_TYPE_URL_MAP[p] ?? p).join(',');
  if (state.washService.length) params['wash'] = state.washService.join(',');
  if (state.dropOff.length) params['dropOff'] = state.dropOff.join(',');
  if (state.pickUp.length) params['pickUp'] = state.pickUp.join(',');
  if (state.source.length) params['source'] = state.source.join(',');
  if (state.priceMin !== null) params['priceMin'] = String(state.priceMin);
  if (state.priceMax !== null) params['priceMax'] = String(state.priceMax);
  if (state.checkInBy.trim()) params['checkInBy'] = state.checkInBy;
  if (state.checkOutBy.trim()) params['checkOutBy'] = state.checkOutBy;
  if (state.name.trim()) params['name'] = state.name;
  if (state.email.trim()) params['email'] = state.email;
  if (state.mobile.trim()) params['mobile'] = state.mobile;
  if (state.plateNo.trim()) params['plate'] = state.plateNo;
  if (state.carBrand.trim()) params['brand'] = state.carBrand;
  if (state.carModel.trim()) params['model'] = state.carModel;
  if (state.carColor.trim()) params['color'] = state.carColor;
  if (state.returnFlight.trim()) params['flight'] = state.returnFlight;
  if (state.sortField) {
    params['sortBy'] = state.sortField;
    params['sortDir'] = state.sortDirection;
  }
  return params;
}

const SORT_FIELDS: BookingSortField[] = [
  'status', 'name', 'plateNo', 'vehicle', 'carColor', 'checkIn', 'checkInBy',
  'dropOff', 'checkOut', 'checkOutBy', 'pickUp', 'returnFlight', 'parkingType',
  'washService', 'source', 'finalPrice',
];

export function filterStateFromQueryParams(
  params: Record<string, string | null>,
  fallback: BookingsFilterState,
): BookingsFilterState {
  const get = (key: string): string | null => (params[key] ? params[key] : null);
  const getList = (key: string, inverseMap?: Record<string, string>): string[] => {
    const raw = get(key);
    if (!raw) return [];
    return raw.split(',').filter(Boolean).map((v) => (inverseMap ? inverseMap[v] ?? v : v));
  };

  const sortByRaw = get('sortBy');
  const sortField = sortByRaw && (SORT_FIELDS as string[]).includes(sortByRaw) ? (sortByRaw as BookingSortField) : null;

  return {
    dateFrom: get('from') ?? fallback.dateFrom,
    dateTo: get('to') ?? fallback.dateTo,
    datePreset: get('preset') ?? fallback.datePreset,
    status: getList('status', STATUS_URL_MAP_INVERSE),
    parkingType: getList('parkingType', PARKING_TYPE_URL_MAP_INVERSE),
    washService: getList('wash'),
    dropOff: getList('dropOff'),
    pickUp: getList('pickUp'),
    source: getList('source'),
    priceMin: get('priceMin') !== null ? Number(get('priceMin')) : null,
    priceMax: get('priceMax') !== null ? Number(get('priceMax')) : null,
    checkInBy: get('checkInBy') ?? '',
    checkOutBy: get('checkOutBy') ?? '',
    name: get('name') ?? '',
    email: get('email') ?? '',
    mobile: get('mobile') ?? '',
    plateNo: get('plate') ?? '',
    carBrand: get('brand') ?? '',
    carModel: get('model') ?? '',
    carColor: get('color') ?? '',
    returnFlight: get('flight') ?? '',
    sortField,
    sortDirection: (get('sortDir') as BookingSortDirection) ?? 'asc',
  };
}
