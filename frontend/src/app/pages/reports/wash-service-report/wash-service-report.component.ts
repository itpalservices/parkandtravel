import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CAR_PICK_UP_OPTIONS,
  CAR_PICK_UP_OPTIONS_LABELS,
} from '../../../shared/statics/car-pick-up.model';
import { WashServiceReportItem } from '../../../shared/models/reports.model';
import { exportToExcel } from '../../../shared/utils/excel-export.util';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';

const REPORT_COLUMNS = ['Full Name', 'Plate No.', 'Vehicle / Model', 'Vehicle Color', 'Car Pick-up', 'Check Out', 'Parking Place'];

@Component({
  selector: 'app-wash-service-report',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbDropdownModule, DateRangePickerComponent],
  templateUrl: './wash-service-report.component.html',
  styleUrl: './wash-service-report.component.scss',
})
export class WashServiceReportComponent implements OnInit {
  private apiService = inject(ApiService);

  dateFilter: DateRange;

  reportData: WashServiceReportItem[] = [];
  loading = false;
  exporting = false;

  private logoBase64: string = '';

  constructor() {
    const today = new Date();
    this.dateFilter = { from: today, to: today, preset: 'today' };
    this.loadLogo();
  }

  ngOnInit(): void {
    this.loadReport();
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFilter = range;
    this.loadReport();
  }

  private loadReport(): void {
    if (!this.dateFilter.from || !this.dateFilter.to) return;

    this.loading = true;
    const dateFrom = this.formatDateForApi(this.dateFilter.from);
    const dateTo = this.formatDateForApi(this.dateFilter.to);

    this.apiService
      .get<WashServiceReportItem[]>(`/reports/wash-service?dateFrom=${dateFrom}&dateTo=${dateTo}`)
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

  private buildTableRows(): string[][] {
    return this.reportData.map((item) => [
      item.fullName,
      item.plateNo,
      item.vehicleModel,
      item.vehicleColor,
      this.formatPickUp(item.carPickup),
      `${item.checkOutDate} ${item.checkOutTime}`,
      item.parkPlace || '-',
    ]);
  }

  exportPDF(): void {
    if (this.reportData.length === 0) return;

    this.exporting = true;

    const doc = new jsPDF();
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
    const title = 'Wash Service Report';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const dateText = `Date: ${this.dateRangeLabel}`;
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, (pageWidth - dateWidth) / 2, yPos);
    yPos += 8;

    const totalText = `Total Cars: ${this.reportData.length}`;
    const totalWidth = doc.getTextWidth(totalText);
    doc.text(totalText, (pageWidth - totalWidth) / 2, yPos);
    yPos += 12;

    const tableData = this.buildTableRows();

    autoTable(doc, {
      startY: yPos,
      head: [REPORT_COLUMNS],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 107, 143],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [55, 65, 81],
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 22 },
        2: { cellWidth: 30 },
        3: { cellWidth: 22 },
        4: { cellWidth: 28 },
        5: { cellWidth: 32 },
        6: { cellWidth: 22 },
      },
      margin: { left: 10, right: 10 },
    });

    const fileName = `wash-service-report-${this.fileNameDateSuffix}.pdf`;
    doc.save(fileName);

    this.exporting = false;
  }

  async exportExcel(): Promise<void> {
    if (this.reportData.length === 0 || this.exporting) return;

    this.exporting = true;
    try {
      await exportToExcel({
        fileName: `wash-service-report-${this.fileNameDateSuffix}.xlsx`,
        sheetName: 'Wash Service',
        title: 'Wash Service Report',
        infoLines: [
          `Date: ${this.dateRangeLabel}`,
          `Total Cars: ${this.reportData.length}`,
        ],
        columns: REPORT_COLUMNS,
        rows: this.buildTableRows(),
      });
    } finally {
      this.exporting = false;
    }
  }

  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDisplayDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  /** e.g. "07/09/2026" for a single day, or "07/09/2026 - 09/09/2026" for a range. */
  get dateRangeLabel(): string {
    if (!this.dateFilter.from) return '-';
    const from = this.formatDisplayDate(this.dateFilter.from);
    const to = this.dateFilter.to ? this.formatDisplayDate(this.dateFilter.to) : from;
    return from === to ? from : `${from} - ${to}`;
  }

  private get fileNameDateSuffix(): string {
    if (!this.dateFilter.from) return '';
    const from = this.formatDateForApi(this.dateFilter.from);
    const to = this.dateFilter.to ? this.formatDateForApi(this.dateFilter.to) : from;
    return from === to ? from : `${from}_to_${to}`;
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
