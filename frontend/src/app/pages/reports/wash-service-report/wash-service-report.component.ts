import { Component, OnInit, inject, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import {
  CAR_DROP_OFF_OPTIONS,
  CAR_DROP_OFF_OPTIONS_LABELS,
} from '../../../shared/statics/car-drop-off.model';
import {
  CAR_PICK_UP_OPTIONS,
  CAR_PICK_UP_OPTIONS_LABELS,
} from '../../../shared/statics/car-pick-up.model';

interface WashServiceReportItem {
  id: string;
  fullName: string;
  plateNo: string;
  vehicleModel: string;
  vehicleColor: string;
  carPickup: string;
  checkOutDate: string;
  checkOutTime: string;
}

@Component({
  selector: 'app-wash-service-report',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, NgbDatepickerModule],
  templateUrl: './wash-service-report.component.html',
  styleUrl: './wash-service-report.component.scss',
})
export class WashServiceReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private calendar = inject(NgbCalendar);
  private elementRef = inject(ElementRef);

  selectedDate: NgbDateStruct;
  minDate: NgbDateStruct;
  isDatepickerOpen = false;

  reportData: WashServiceReportItem[] = [];
  loading = false;

  constructor() {
    const today = this.calendar.getToday();
    this.selectedDate = today;
    this.minDate = today;
  }

  ngOnInit(): void {
    this.loadReport();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isDatepickerOpen = false;
    }
  }

  toggleDatepicker(): void {
    this.isDatepickerOpen = !this.isDatepickerOpen;
  }

  onDateSelect(date: NgbDateStruct): void {
    this.selectedDate = date;
    this.isDatepickerOpen = false;
    this.loadReport();
  }

  private loadReport(): void {
    this.loading = true;
    const dateStr = this.formatDateForApi(this.selectedDate);

    this.apiService
      .get<WashServiceReportItem[]>(`/reports/wash-service?date=${dateStr}`)
      .subscribe({
        next: (data) => {
          this.reportData = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading wash service report:', err);
          this.loading = false;
        },
      });
  }

  private formatDateForApi(date: NgbDateStruct): string {
    const year = date.year;
    const month = date.month.toString().padStart(2, '0');
    const day = date.day.toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDisplayDate(date: NgbDateStruct): string {
    const day = date.day.toString().padStart(2, '0');
    const month = date.month.toString().padStart(2, '0');
    return `${day}/${month}/${date.year}`;
  }

  formatPickUp(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case CAR_PICK_UP_OPTIONS.selfPickUp:
        return CAR_PICK_UP_OPTIONS_LABELS.selfPickUp;
      case CAR_PICK_UP_OPTIONS.deliveryToAirport:
        return CAR_PICK_UP_OPTIONS_LABELS.deliveryToAirport;
      default:
        return '-';
    }
  }
}
