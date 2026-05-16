import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ZReportData } from '../../../shared/models/reports.model';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-z-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, DateRangePickerComponent],
  templateUrl: './z-reports.component.html',
  styleUrl: './z-reports.component.scss',
})
export class ZReportsComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private calendar = inject(NgbCalendar);

  loading = false;
  reports: ZReportData[] = [];
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

  load(): void {
    if (!this.dateFilter.from || !this.dateFilter.to) return;
    this.loading = true;

    const dateFrom = this.formatDate(this.dateFilter.from);
    const dateTo = this.formatDate(this.dateFilter.to);

    this.apiService.get<ZReportData[]>(`/reports/z-report-new/history?dateFrom=${dateFrom}&dateTo=${dateTo}`).subscribe({
      next: (data) => {
        this.reports = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFilter = range;
    this.load();
  }

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  isMatch(report: ZReportData): boolean {
    return report.declaredCash === report.actualCash && report.declaredCard === report.actualCard;
  }

  viewDetail(id: string): void {
    this.router.navigate(['/admin/reports/z-reports', id]);
  }
}
