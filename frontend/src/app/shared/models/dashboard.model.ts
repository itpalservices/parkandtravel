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
  todayCheckOuts: number;
  carsForWashToday: number;
  carsForWashTomorrow: number;
}