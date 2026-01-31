export interface ReportCard {
  id: string;
  title: string;
  description: string;
}

export interface DailyInOutReportItem {
  id: string;
  fullName: string;
  plateNo: string;
  vehicleModel: string;
  vehicleColor: string;
  checkInDate: string;
  checkInTime: string;
  carDropOff: string;
  checkOutDate: string;
  checkOutTime: string;
  carPickup: string;
  flightNo: string;
  parkingType: string;
  bookingType: string;
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