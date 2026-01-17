import { Component, OnInit, inject, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CAR_DROP_OFF_OPTIONS,
  CAR_DROP_OFF_OPTIONS_LABELS,
} from '../../../shared/statics/car-drop-off.model';
import {
  CAR_PICK_UP_OPTIONS,
  CAR_PICK_UP_OPTIONS_LABELS,
} from '../../../shared/statics/car-pick-up.model';

interface DailyInOutReportItem {
  id: string;
  fullName: string;
  plateNo: string;
  vehicleModel: string;
  vehicleColor: string;
  checkInDate: string;
  checkInTime: string;
  carDropOff: string;
  checkOutDate: string;
  checkOutTime: string;
  carPickup: string;
  flightNo: string;
  parkingType: string;
  bookingType: string;
}

@Component({
  selector: 'app-daily-in-out-report',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, NgbDatepickerModule],
  templateUrl: './daily-in-out-report.component.html',
  styleUrl: './daily-in-out-report.component.scss',
})
export class DailyInOutReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private calendar = inject(NgbCalendar);
  private elementRef = inject(ElementRef);

  selectedDate: NgbDateStruct;
  minDate: NgbDateStruct;
  isDatepickerOpen = false;

  reportData: DailyInOutReportItem[] = [];
  loading = false;
  exporting = false;

  private logoBase64: string = '';

  constructor() {
    const today = this.calendar.getToday();
    this.selectedDate = today;
    this.minDate = today;
    this.loadLogo();
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
      .get<DailyInOutReportItem[]>(`/reports/daily-in-out?date=${dateStr}`)
      .subscribe({
        next: (data) => {
          this.reportData = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading daily in/out report:', err);
          this.loading = false;
        },
      });
  }

  private loadLogo(): void {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        this.logoBase64 = canvas.toDataURL('image/png');
      }
    };
    img.src = 'assets/img/park-and-travel-logo.png';
  }

  exportPDF(): void {
    if (this.reportData.length === 0) return;

    this.exporting = true;

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();

    let yPos = 15;

    if (this.logoBase64) {
      const logoWidth = 50;
      const logoHeight = 20;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(this.logoBase64, 'PNG', logoX, yPos, logoWidth, logoHeight);
      yPos += logoHeight + 10;
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 107, 143);
    const title = 'Daily In/Out Report';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const dateText = `Date: ${this.formatDisplayDate(this.selectedDate)}`;
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, (pageWidth - dateWidth) / 2, yPos);
    yPos += 8;

    const totalText = `Total Bookings: ${this.reportData.length}`;
    const totalWidth = doc.getTextWidth(totalText);
    doc.text(totalText, (pageWidth - totalWidth) / 2, yPos);
    yPos += 12;

    const tableData = this.reportData.map((item) => [
      item.fullName,
      item.plateNo,
      item.vehicleModel,
      item.vehicleColor,
      `${item.checkInDate} ${item.checkInTime}`,
      this.formatDropOff(item.carDropOff),
      `${item.checkOutDate} ${item.checkOutTime}`,
      this.formatPickUp(item.carPickup),
      item.flightNo,
      item.parkingType,
      item.bookingType,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Full Name', 'Plate No.', 'Vehicle', 'Color', 'Check In', 'Drop-off', 'Check Out', 'Pick-up', 'Flight', 'Parking', 'Type']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 107, 143],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [55, 65, 81],
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { left: 10, right: 10 },
    });

    const fileName = `daily-in-out-report-${this.formatDateForApi(this.selectedDate)}.pdf`;
    doc.save(fileName);

    this.exporting = false;
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

  formatDropOff(option: string | null): string {
    if (!option || option === '-') return '-';
    switch (option) {
      case CAR_DROP_OFF_OPTIONS.selfDropOff:
        return CAR_DROP_OFF_OPTIONS_LABELS.selfDropOff;
      case CAR_DROP_OFF_OPTIONS.airportPickUp:
        return CAR_DROP_OFF_OPTIONS_LABELS.airportPickUp;
      default:
        return '-';
    }
  }

  formatPickUp(option: string | null): string {
    if (!option || option === '-') return '-';
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
