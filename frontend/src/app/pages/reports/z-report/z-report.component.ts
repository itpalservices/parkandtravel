import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-z-report',
  standalone: true,
  imports: [CommonModule, RouterLink, DateRangePickerComponent],
  templateUrl: './z-report.component.html',
  styleUrl: './z-report.component.scss',
})
export class ZReportComponent {
  private calendar = inject(NgbCalendar);

  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  selectedPreset: string | null = 'today';

  loading = false;

  constructor() {
    const today = this.calendar.getToday();
    const todayDate = new Date(today.year, today.month - 1, today.day);
    this.dateFrom = todayDate;
    this.dateTo = todayDate;
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.selectedPreset = range.preset;
  }

  formatDisplayDate(date: Date | null): string {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }
}
