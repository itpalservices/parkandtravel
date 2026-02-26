import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DateRangePickerComponent, DateRange } from '../../shared/components/date-range-picker/date-range-picker.component';
import { ApiService } from '../../core/services/api.service';
import { CheckInOutItem, DashboardStats } from '../../shared/models/dashboard.model';
import { DashboardDetailsComponent, CardType } from './dashboard-details/dashboard-details.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DateRangePickerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);
  private modalService = inject(NgbModal);

  stats: DashboardStats = {
    totalCars: 0,
    todayCheckIns: 0,
    todayCheckInsAmount: 0,
    todayCheckOuts: 0,
    todayCheckOutsAmount: 0,
    carsForWashToday: 0,
    carsForWashTomorrow: 0
  };

  loading = true;
  loadingCheckIns = true;
  loadingCheckOuts = true;

  upcomingCheckIns: CheckInOutItem[] = [];
  upcomingCheckOuts: CheckInOutItem[] = [];

  private checkInDateRange: DateRange | null = null;
  private checkOutDateRange: DateRange | null = null;

  ngOnInit(): void {
    this.loadDashboardStats();
    const today = new Date();
    const todayStr = this.formatDateForApi(today);
    this.loadCheckIns(todayStr, todayStr);
    this.loadCheckOuts(todayStr, todayStr);
  }

  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  private loadCheckIns(dateFrom: string, dateTo: string): void {
    this.loadingCheckIns = true;
    this.apiService.get<CheckInOutItem[]>(`/dashboard/check-ins?dateFrom=${dateFrom}&dateTo=${dateTo}`).subscribe({
      next: (checkIns) => {
        this.upcomingCheckIns = checkIns;
        this.loadingCheckIns = false;
      },
      error: (err) => {
        console.error('Error loading check-ins:', err);
        this.loadingCheckIns = false;
      }
    });
  }

  private loadCheckOuts(dateFrom: string, dateTo: string): void {
    this.loadingCheckOuts = true;
    this.apiService.get<CheckInOutItem[]>(`/dashboard/check-outs?dateFrom=${dateFrom}&dateTo=${dateTo}`).subscribe({
      next: (checkOuts) => {
        this.upcomingCheckOuts = checkOuts;
        this.loadingCheckOuts = false;
      },
      error: (err) => {
        console.error('Error loading check-outs:', err);
        this.loadingCheckOuts = false;
      }
    });
  }

  onCheckInDateRangeChange(range: DateRange): void {
    this.checkInDateRange = range;
    if (range.from && range.to) {
      const dateFrom = this.formatDateForApi(range.from);
      const dateTo = this.formatDateForApi(range.to);
      this.loadCheckIns(dateFrom, dateTo);
    }
  }

  onCheckOutDateRangeChange(range: DateRange): void {
    this.checkOutDateRange = range;
    if (range.from && range.to) {
      const dateFrom = this.formatDateForApi(range.from);
      const dateTo = this.formatDateForApi(range.to);
      this.loadCheckOuts(dateFrom, dateTo);
    }
  }

  openCardDetails(cardType: CardType): void {
    const modalRef = this.modalService.open(DashboardDetailsComponent, {
      size: 'lg',
      centered: true
    });
    modalRef.componentInstance.cardType = cardType;
  }
}
