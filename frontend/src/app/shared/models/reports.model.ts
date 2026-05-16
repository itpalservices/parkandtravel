export interface ReportCard {
  id: string;
  title: string;
  description: string;
}

export interface DailyInOutReportItem {
  id: string;
  bookingStatus: string;
  bookingType: string;
  time: string;
  flightNo: string;
  fullName: string;
  phone: string;
  vehicle: string;
  plateNo: string;
  parkPlace: string;
  finalPrice: number | null;
  extraFee: number | null;
  adults: number | null;
  dropOffOption: string | null;
  pickUpOption: string | null;
  keyOption: boolean;
}

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

export interface PendingBookingsReportItem {
  id: string;
  fullName: string;
  mobile: string;
  plateNo: string;
  vehicleModel: string;
  vehicleColor: string;
  checkOutDate: string;
  checkOutTime: string;
}

export interface WalleeResponse {
  data: WalleeTransaction[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface WalleeTransaction {
  id: number;
  createdOn: string;
  authorizationAmount: number;
  currency: string;
  state: string;
  metaData: {
    customerName: string;
    carBrand: string;
    plateNo: string;
  };
  merchantReference?: string;
  failureReason?: { name?: { 'en-US': string } };
  [key: string]: any;
}

export interface XReportTransaction {
  id: string;
  bookingId: string;
  datetime: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  plateNo: string | null;
  type: 'checkin' | 'checkout';
}

export interface XReportData {
  transactions: XReportTransaction[];
  totals: Record<string, number>;
}

export interface ZReportEmployee {
  userId: string;
  name: string;
  surname: string;
  email: string;
  role: string;
}

export interface ZReportData {
  id: string;
  targetUserId: string;
  targetUserName: string;
  runByUserId: string;
  runByUserName: string;
  declaredCash: number;
  declaredCard: number;
  actualCash: number;
  actualCard: number;
  createdAt: string;
  transactions: XReportTransaction[];
}