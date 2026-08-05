import { Component, OnInit, inject, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PendingBookingsReportItem } from '../../../shared/models/reports.model';
import { exportToExcel } from '../../../shared/utils/excel-export.util';

const REPORT_COLUMNS = ['Full Name', 'Plate No.', 'Vehicle / Model', 'Vehicle Color', 'Check Out'];

@Component({
  selector: 'app-pending-bookings-report',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, NgbDatepickerModule, NgbDropdownModule],
  templateUrl: './pending-bookings-report.component.html',
  styleUrl: './pending-bookings-report.component.scss',
})
export class PendingBookingsReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private calendar = inject(NgbCalendar);
  private elementRef = inject(ElementRef);

  today: NgbDateStruct;

  reportData: PendingBookingsReportItem[] = [];
  loading = false;
  exporting = false;

  private logoBase64: string = '';

  constructor() {
    this.today = this.calendar.getToday();
    this.loadLogo();
  }

  ngOnInit(): void {
    this.loadReport();
  }

  private loadReport(): void {
    this.loading = true;

    this.apiService
      .get<PendingBookingsReportItem[]>(`/reports/pending-bookings`)
      .subscribe({
        next: (data) => {
          this.reportData = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading pending bookings report:', err);
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
      `${item.fullName} (${item.mobile})`,
      item.plateNo,
      item.vehicleModel,
      item.vehicleColor,
      `${item.checkOutDate} ${item.checkOutTime}`,
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
    const title = 'Pending Bookings Report';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const dateText = `Date: ${this.formatDisplayDate(this.today)}`;
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
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        5: { cellWidth: 35 },
      },
      margin: { left: 10, right: 10 },
    });

    const fileName = `pending-bookings-report-${this.formatDateForApi(this.today)}.pdf`;
    doc.save(fileName);

    this.exporting = false;
  }

  async exportExcel(): Promise<void> {
    if (this.reportData.length === 0 || this.exporting) return;

    this.exporting = true;
    try {
      await exportToExcel({
        fileName: `pending-bookings-report-${this.formatDateForApi(this.today)}.xlsx`,
        sheetName: 'Pending Bookings',
        title: 'Pending Bookings Report',
        infoLines: [
          `Date: ${this.formatDisplayDate(this.today)}`,
          `Total Cars: ${this.reportData.length}`,
        ],
        columns: REPORT_COLUMNS,
        rows: this.buildTableRows(),
      });
    } finally {
      this.exporting = false;
    }
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
}
