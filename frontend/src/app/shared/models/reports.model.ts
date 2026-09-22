import { ShiftTransaction, ShiftTotals } from './shifts.model';

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
  parkPlace: string | null;
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

export interface OpenShiftEmployeeSummary {
  userId: string;
  employeeName: string;
  shiftId: number;
  shiftStart: string;
  transactions: ShiftTransaction[];
  totals: ShiftTotals[];
  employeeTotal: number;
}

export interface AdminXReportData {
  employees: OpenShiftEmployeeSummary[];
  grandTotal: number;
  grandTotals: ShiftTotals[];
}

export interface ZReportEmployeeSummary {
  userId: string;
  employeeName: string;
  transactions: ShiftTransaction[];
  totals: ShiftTotals[];
  employeeTotal: number;
}

/** A Z-report is a global sweep, not a per-employee reconciliation — one run can cover several
 *  employees' closed shifts at once, with no declared-vs-actual amounts anymore. */
export interface ZReportData {
  id: string;
  runByUserId: string;
  runByUserName: string;
  createdAt: string;
  employees: ZReportEmployeeSummary[];
  grandTotal: number;
  grandTotals: ShiftTotals[];
}

export interface ZReportHistoryItem {
  id: string;
  runByUserId: string;
  runByUserName: string;
  createdAt: string;
  employeeCount: number;
  transactionCount: number;
  grandTotal: number;
}