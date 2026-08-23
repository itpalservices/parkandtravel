export interface Booking {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  phoneCode: string | null;
  plateNo: string;
  carBrand: string | null;
  carModel: string | null;
  carColor: string | null;
  dateFrom: string;
  dateTo: string;
  timeFrom: string | null;
  timeTo: string | null;
  checkInBy: string | null;
  checkOutBy: string | null;
  adults: number;
  returnFlight: string | null;
  parkingTypeId: string;
  parkingType?: string;
  washService: boolean;
  finalPrice: number | null;
  dropOffOption: string | null;
  pickUpOption: string | null;
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
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  walleePaidAmount?: number;
  checkinPaidAmount?: number;
  completionPaidAmount?: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'overpaid' | 'unpaid' | null;
  estimated_arrival_time: string | null;
  thumbnailUrl: string | null;
}

export interface BookingsResponse {
  success: boolean;
  data: Booking[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BookingResponse {
  success: boolean;
  data: Booking;
}

export interface ParkingType {
  id: string;
  name: string;
  pricePerDay: number | null;
  priceIncrements: number[] | null;
}

export interface ParkingTypesResponse {
  parkingTypes: ParkingType[];
  washAvailable: boolean;
  washPrice: number | null;
  deliveryFee: number | null;
  mandatoryPrePayment: boolean;
  airportDeliveryEnabled: boolean;
  availableAfter: number;
  returnDetailsDefaultEnabled: boolean;
  defaultParkingTypeId: string | null;
}

export interface HistoryBooking {
  id: string;
  plateNo: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  dateFrom: string;
  timeFrom: string | null;
  dateTo: string;
  timeTo: string | null;
  parkingType: string;
  washService: boolean;
  finalPrice: number | null;
  dropOffOption: string | null;
  pickUpOption: string | null;
  bookingStatusId: string | null;
  bookingStatus: string | null;
  actualCheckOut: string | null;
  extraFee: number | null;
}

export interface BookingDetails {
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
  washService: boolean;
  finalPrice: number | null;
  dropOffOption: string | null;
  pickUpOption: string | null;
  userId: string | null;
  bookingStatusId: string | null;
  bookingStatus: string | null;
  parkPlace: string | null;
  walleePaidAmount?: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'overpaid' | 'unpaid' | null;
  isPrepaid: boolean;
  walleePayment: { amount: number; createdAt: string } | null;
}

export interface DateRangeFilter {
  dateFrom: string | null;
  dateTo: string | null;
}

export interface BookingImageInfo {
  url: string;
  createdAt: string;
}

/** One key per sortable bookings-list column — kept 1:1 with the table's header order. */
export type BookingSortField =
  | 'status'
  | 'name'
  | 'plateNo'
  | 'vehicle'
  | 'carColor'
  | 'checkIn'
  | 'checkInBy'
  | 'dropOff'
  | 'checkOut'
  | 'checkOutBy'
  | 'pickUp'
  | 'returnFlight'
  | 'parkingType'
  | 'washService'
  | 'source'
  | 'finalPrice';

export type BookingSortDirection = 'asc' | 'desc';

/** Full filter + sort state for the bookings list filter panel. */
export interface BookingsFilterState {
  dateFrom: string | null;
  dateTo: string | null;
  datePreset: string | null;
  status: string[];
  parkingType: string[];
  washService: string[]; // 'yes' | 'no'
  dropOff: string[];
  pickUp: string[];
  source: string[]; // 'registered' | 'guest' — admin only
  priceMin: number | null;
  priceMax: number | null;
  checkInBy: string; // admin only
  checkOutBy: string; // admin only
  name: string;
  email: string;
  mobile: string;
  plateNo: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  returnFlight: string;
  sortField: BookingSortField | null;
  sortDirection: BookingSortDirection;
}