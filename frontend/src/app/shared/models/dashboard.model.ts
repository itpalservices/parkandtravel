export interface CheckInOutItem {
  id: string;
  plateNo: string;
  customerName: string;
  date: string;
  time: string;
  flightNumber: string;
}

export interface DashboardStats {
  totalCars: number;
  todayCheckIns: number;
  todayCheckInsAmount: number;
  todayCheckOuts: number;
  todayCheckOutsAmount: number;
  carsForWashToday: number;
  carsForWashTomorrow: number;
}

export interface DashboardDetailItem {
  id: string;
  customerName: string;
  phoneNumber: string;
  phoneCode: string | null;
  plateNo: string;
  vehicleModel: string;
  checkIn: string;
  checkOut: string;
  parkPlace?: string;
}

export type CardType = 'total-cars' | 'today-check-ins' | 'today-check-outs' | 'wash-today' | 'wash-tomorrow';