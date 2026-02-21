import { Component, OnInit, inject, ElementRef, HostListener } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyInOutReportItem } from '../../../shared/models/reports.model';

@Component({
  selector: 'app-daily-in-out-report',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, NgbDatepickerModule, CurrencyPipe],
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
  filterBy: 'check-ins' | 'check-outs' | 'both' = 'check-ins';

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

  onFilterByChange(filter: 'check-ins' | 'check-outs' | 'both'): void {
    this.filterBy = filter;
    this.loadReport();
  }

  private loadReport(): void {
    this.loading = true;
    const dateStr = this.formatDateForApi(this.selectedDate);

    this.apiService
      .get<DailyInOutReportItem[]>(`/reports/daily-in-out?date=${dateStr}&filterBy=${this.filterBy}`)
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

    const tableData = this.reportData.map((item) => {
      let priceStr = '-';
      if (item.finalPrice !== null) {
        const price = Number(item.finalPrice) || 0;
        const extra = item.extraFee ? Number(item.extraFee) : 0;
        priceStr = `€${(price + extra).toFixed(2)}`;
      }
      return [
        item.bookingStatus,
        this.getTypeLabel(item),
        item.time || '-',
        item.flightNo,
        item.fullName,
        item.phone,
        item.vehicle,
        item.plateNo,
        item.parkPlace,
        priceStr,
        item.adults !== null ? item.adults.toString() : '-',
      ];
    });

    const typeColumnIndex = 1;
    autoTable(doc, {
      startY: yPos,
      head: [['Status', 'Type', 'Time', 'Flight No.', 'Full Name', 'Phone', 'Vehicle', 'Plate No.', 'Park Place', 'Price', 'Adults']],
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
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === typeColumnIndex) {
          const cellText = data.cell.raw;
          if (cellText === 'P') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (cellText === 'Airport') {
            data.cell.styles.textColor = [37, 99, 235];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
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

  getTypeLabel(item: DailyInOutReportItem): string {
    if (item.bookingType === 'In') {
      return item.dropOffOption === 'self_drive' ? 'P' : 'Airport';
    } else {
      return item.pickUpOption === 'self_pickup' ? 'P' : 'Airport';
    }
  }

  isTypeSelfDrive(item: DailyInOutReportItem): boolean {
    if (item.bookingType === 'In') {
      return item.dropOffOption === 'self_drive';
    } else {
      return item.pickUpOption === 'self_pickup';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Created':
        return 'bg-warning text-dark';
      case 'Parked':
        return 'bg-info';
      case 'Completed':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  }
}
