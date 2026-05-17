import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import { ReceiptReportItem, ReceiptsReportResponse } from '../../../shared/models/reports.model';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-receipts-report',
  standalone: true,
  imports: [CommonModule, RouterLink, DateRangePickerComponent],
  templateUrl: './receipts-report.component.html',
  styleUrl: './receipts-report.component.scss',
})
export class ReceiptsReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private calendar = inject(NgbCalendar);

  loading = false;
  receipts: ReceiptReportItem[] = [];
  total = 0;
  page = 1;
  totalPages = 1;
  dateFilter: DateRange;

  constructor() {
    const today = this.calendar.getToday();
    const from = new Date(today.year, today.month - 1, 1);
    const to = new Date(today.year, today.month - 1, today.day);
    this.dateFilter = { from, to, preset: 'custom' };
  }

  ngOnInit(): void {
    this.load();
  }

  load(page = 1): void {
    if (!this.dateFilter.from || !this.dateFilter.to) return;
    this.loading = true;
    this.page = page;

    const dateFrom = this.formatApiDate(this.dateFilter.from);
    const dateTo = this.formatApiDate(this.dateFilter.to);

    this.apiService
      .get<ReceiptsReportResponse>(`/reports/receipts?dateFrom=${dateFrom}&dateTo=${dateTo}&page=${page}`)
      .subscribe({
        next: (res) => {
          this.receipts = res.data;
          this.total = res.total;
          this.totalPages = res.totalPages;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFilter = range;
    this.load(1);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.load(page);
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages;
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (this.page > 3) pages.push(-1);
      const start = Math.max(2, this.page - 1);
      const end = Math.min(total - 1, this.page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (this.page < total - 2) pages.push(-1);
      pages.push(total);
    }
    return pages;
  }

  downloadReceipt(id: string): void {
    window.open(`/api/receipts/${id}/pdf`, '_blank');
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  carDescription(item: ReceiptReportItem): string {
    return [item.carBrand, item.carModel].filter(Boolean).join(' ') || '-';
  }

  private formatApiDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
