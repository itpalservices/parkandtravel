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