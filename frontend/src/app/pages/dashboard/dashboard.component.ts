import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateRangePickerComponent, DateRange } from '../../shared/components/date-range-picker/date-range-picker.component';
import { ApiService } from '../../core/services/api.service';

interface CheckInOutItem {
  licensePlate: string;
  customerName: string;
  time: string;
  flightNumber: string;
}

interface DashboardStats {
  totalCars: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  carsForWashToday: number;
  carsForWashTomorrow: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DateRangePickerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);

  stats: DashboardStats = {
    totalCars: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    carsForWashToday: 0,
    carsForWashTomorrow: 0
  };

  loading = true;

  upcomingCheckIns: CheckInOutItem[] = [
    { licensePlate: 'ABC-1234', customerName: 'John Doe', time: '14:30', flightNumber: 'FR123' },
    { licensePlate: 'XYZ-5678', customerName: 'Maria P.', time: '16:15', flightNumber: 'A3456' },
    { licensePlate: 'DEF-9012', customerName: 'Dimitris K.', time: '18:45', flightNumber: 'EK789' },
    { licensePlate: 'DEF-9012', customerName: 'Nikos K.', time: '18:45', flightNumber: 'EK789' },
    { licensePlate: 'GHI-3456', customerName: 'Anna S.', time: '20:00', flightNumber: 'LH234' },
    { licensePlate: 'JKL-7890', customerName: 'Kostas M.', time: '21:30', flightNumber: 'BA567' },
  ];

  upcomingCheckOuts: CheckInOutItem[] = [
    { licensePlate: 'GHI-3456', customerName: 'Anna S.', time: '09:00', flightNumber: 'LH234' },
    { licensePlate: 'JKL-7890', customerName: 'Kostas M.', time: '11:30', flightNumber: 'BA567' },
    { licensePlate: 'MNO-2345', customerName: 'Elena T.', time: '15:20', flightNumber: 'TK890' },
    { licensePlate: 'MNO-2345', customerName: 'Christina T.', time: '15:20', flightNumber: 'TK890' },
    { licensePlate: 'PQR-6789', customerName: 'George P.', time: '17:45', flightNumber: 'AZ123' },
  ];

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  private loadDashboardStats(): void {
    this.loading = true;
    this.apiService.get<DashboardStats>('/dashboard/stats').subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading dashboard stats:', err);
        this.loading = false;
      }
    });
  }

  onCheckInDateRangeChange(range: DateRange): void {
    console.log('Check-in date range:', range);
  }

  onCheckOutDateRangeChange(range: DateRange): void {
    console.log('Check-out date range:', range);
  }
}
