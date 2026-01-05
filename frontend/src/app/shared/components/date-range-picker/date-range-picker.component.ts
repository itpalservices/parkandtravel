import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';

export interface DateRange {
  from: Date | null;
  to: Date | null;
  preset: string | null;
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbDatepickerModule],
  templateUrl: './date-range-picker.component.html',
  styleUrls: ['./date-range-picker.component.scss'],
})
export class DateRangePickerComponent implements OnInit {
  @Input() selectedPreset: string | null = null;
  @Output() dateRangeChange = new EventEmitter<DateRange>();

  isOpen = false;
  showCustomRange = false;

  presets = [
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'next7days', label: 'Next 7 Days' },
    { id: 'next30days', label: 'Next 30 Days' },
    { id: 'custom', label: 'Custom Range' },
  ];

  activePreset: string | null = null;

  fromDate: NgbDateStruct | null = null;
  toDate: NgbDateStruct | null = null;

  appliedFromDate: NgbDateStruct | null = null;
  appliedToDate: NgbDateStruct | null = null;

  minDate: NgbDateStruct;
  toMinDate: NgbDateStruct;
  displayDate: string = '';

  constructor(
    private calendar: NgbCalendar,
    private elementRef: ElementRef,
  ) {
    const today = this.calendar.getToday();
    this.minDate = today;
    this.toMinDate = today;
  }

  ngOnInit(): void {
    if (this.selectedPreset && this.selectedPreset !== 'custom') {
      this.activePreset = this.selectedPreset;
      const range = this.getDateRangeForPreset(this.selectedPreset);
      this.appliedFromDate = this.dateToNgbDate(range.from);
      this.appliedToDate = this.dateToNgbDate(range.to);
    }
    this.updateDisplayDate();
  }

  private dateToNgbDate(date: Date): NgbDateStruct {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
      this.showCustomRange = false;
    }
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.showCustomRange = false;
    }
  }

  selectPreset(presetId: string): void {
    if (presetId === 'custom') {
      this.showCustomRange = true;
      this.activePreset = 'custom';

      if (this.appliedFromDate && this.appliedToDate) {
        this.fromDate = { ...this.appliedFromDate };
        this.toDate = { ...this.appliedToDate };
        this.updateToMinDate();
      } else {
        const today = this.calendar.getToday();
        this.fromDate = today;
        this.toDate = today;
        this.toMinDate = today;
      }
    } else {
      this.activePreset = presetId;
      this.showCustomRange = false;
      const range = this.getDateRangeForPreset(presetId);
      this.emitDateRange(range.from, range.to, presetId);
      this.isOpen = false;
    }
  }

  onFromDateChange(): void {
    this.updateToMinDate();
    if (this.toDate && this.fromDate && this.compareDates(this.toDate, this.fromDate) < 0) {
      this.toDate = { ...this.fromDate };
    }
  }

  private updateToMinDate(): void {
    if (this.fromDate) {
      const today = this.calendar.getToday();
      if (this.compareDates(this.fromDate, today) >= 0) {
        this.toMinDate = { ...this.fromDate };
      } else {
        this.toMinDate = today;
      }
    } else {
      this.toMinDate = this.calendar.getToday();
    }
  }

  applyCustomRange(): void {
    if (this.fromDate && this.toDate) {
      this.appliedFromDate = { ...this.fromDate };
      this.appliedToDate = { ...this.toDate };

      const from = this.ngbDateToDate(this.fromDate);
      const to = this.ngbDateToDate(this.toDate);
      this.emitDateRange(from, to, 'custom');
      this.isOpen = false;
      this.showCustomRange = false;
    }
  }

  isDateDisabled = (date: NgbDateStruct): boolean => {
    const today = this.calendar.getToday();
    return this.compareDates(date, today) < 0;
  };

  isToDateDisabled = (date: NgbDateStruct): boolean => {
    if (this.compareDates(date, this.toMinDate) < 0) {
      return true;
    }
    return false;
  };

  private compareDates(date1: NgbDateStruct, date2: NgbDateStruct): number {
    if (date1.year !== date2.year) return date1.year - date2.year;
    if (date1.month !== date2.month) return date1.month - date2.month;
    return date1.day - date2.day;
  }

  private getDateRangeForPreset(presetId: string): { from: Date; to: Date } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (presetId) {
      case 'today':
        return { from: today, to: today };
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { from: tomorrow, to: tomorrow };
      case 'next7days':
        const next7 = new Date(today);
        next7.setDate(next7.getDate() + 7);
        return { from: today, to: next7 };
      case 'next30days':
        const next30 = new Date(today);
        next30.setDate(next30.getDate() + 30);
        return { from: today, to: next30 };
      default:
        return { from: today, to: today };
    }
  }

  private ngbDateToDate(ngbDate: NgbDateStruct): Date {
    return new Date(ngbDate.year, ngbDate.month - 1, ngbDate.day);
  }

  private emitDateRange(from: Date | null, to: Date | null, preset: string | null): void {
    this.dateRangeChange.emit({ from, to, preset });
    this.updateDisplayDate();
  }

  private updateDisplayDate(): void {
    const today = new Date();
    this.displayDate = this.formatDate(today);
  }

  formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatNgbDate(date: NgbDateStruct | null): string {
    if (!date) return '';
    const day = date.day.toString().padStart(2, '0');
    const month = date.month.toString().padStart(2, '0');
    return `${day}/${month}/${date.year}`;
  }

  get displayRangeText(): string {
    if (this.activePreset === 'custom' && this.appliedFromDate && this.appliedToDate) {
      return this.formatNgbDate(this.appliedFromDate) === this.formatNgbDate(this.appliedToDate)
        ? this.formatNgbDate(this.appliedFromDate)
        : `${this.formatNgbDate(this.appliedFromDate)} - ${this.formatNgbDate(this.appliedToDate)}`;
    }
    if (this.activePreset) {
      const preset = this.presets.find((p) => p.id === this.activePreset);
      if (preset && preset.id !== 'custom') {
        return preset.label;
      }
    }
    return this.displayDate;
  }
}
