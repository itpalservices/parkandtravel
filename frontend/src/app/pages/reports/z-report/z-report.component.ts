import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';

export interface WalleeTransaction {
  id: number;
  createdOn: string;
  authorizationAmount: number;
  currency: string;
  state: string;
  merchantReference?: string;
  failureReason?: { name?: { 'en-US': string } };
  [key: string]: any;
}

interface WalleeResponse {
  data: WalleeTransaction[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

@Component({
  selector: 'app-z-report',
  standalone: true,
  imports: [CommonModule, RouterLink, DateRangePickerComponent],
  templateUrl: './z-report.component.html',
  styleUrl: './z-report.component.scss',
})
export class ZReportComponent {
  private calendar = inject(NgbCalendar);
  private apiService = inject(ApiService);

  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  selectedPreset: string | null = 'today';

  loading = false;
  error: string | null = null;

  walleeData: WalleeResponse | null = null;
  currentOffset = 0;
  readonly pageSize = 10;

  constructor() {
    const today = this.calendar.getToday();
    const todayDate = new Date(today.year, today.month - 1, today.day);
    this.dateFrom = todayDate;
    this.dateTo = todayDate;
    this.loadReport();
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.selectedPreset = range.preset;
    this.currentOffset = 0;
    this.loadReport();
  }

  loadReport(): void {
    if (!this.dateFrom || !this.dateTo) return;

    this.loading = true;
    this.error = null;

    const dateFromStr = this.formatDateForApi(this.dateFrom);
    const dateToStr = this.formatDateForApi(this.dateTo);

    this.apiService
      .get<WalleeResponse>(`/reports/z-report?dateFrom=${dateFromStr}&dateTo=${dateToStr}&offset=${this.currentOffset}`)
      .subscribe({
        next: (data) => {
          this.walleeData = data;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to load report. Please try again.';
          this.loading = false;
        },
      });
  }

  goToPreviousPage(): void {
    if (this.currentOffset === 0) return;
    this.currentOffset = Math.max(0, this.currentOffset - this.pageSize);
    this.loadReport();
  }

  goToNextPage(): void {
    if (!this.walleeData?.hasMore) return;
    this.currentOffset += this.pageSize;
    this.loadReport();
  }

  get currentPage(): number {
    return Math.floor(this.currentOffset / this.pageSize) + 1;
  }

  formatCreatedOn(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  formatAmount(amount: number, currency: string): string {
    if (amount == null) return '-';
    return `${currency} ${Number(amount).toFixed(2)}`;
  }

  getStatusClass(state: string): string {
    switch (state?.toUpperCase()) {
      case 'FULFILL': return 'status-fulfill';
      case 'FAILED': return 'status-failed';
      case 'AUTHORIZED': return 'status-authorized';
      case 'CONFIRMED': return 'status-confirmed';
      case 'PROCESSING': return 'status-processing';
      case 'VOIDED': return 'status-voided';
      default: return 'status-default';
    }
  }

  getStatusLabel(state: string): string {
    if (!state) return '-';
    return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
  }

  formatDisplayDate(date: Date | null): string {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
