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