import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';

interface WalleeResponse {
  data: any[];
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
          console.log('Wallee Z-Report response:', data);
        },
        error: (err) => {
          console.error('Error loading z-report:', err);
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
