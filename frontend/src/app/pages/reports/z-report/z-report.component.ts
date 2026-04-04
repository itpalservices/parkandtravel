import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../../../core/services/api.service';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';
import { WalleeResponse, WalleeTransaction } from '../../../shared/models/reports.model';

const SUCCESS_STATES = ['FULFILL', 'AUTHORIZED', 'CONFIRMED', 'COMPLETED'];
const FAILED_STATES = ['FAILED', 'VOIDED', 'DECLINE', 'DECLINED'];

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
  exporting = false;
  error: string | null = null;

  walleeData: WalleeResponse | null = null;
  currentOffset = 0;
  readonly pageSize = 10;

  private logoBase64: string = '';

  constructor() {
    const today = this.calendar.getToday();
    const todayDate = new Date(today.year, today.month - 1, today.day);
    this.dateFrom = todayDate;
    this.dateTo = todayDate;
    this.loadLogo();
    this.loadReport();
  }

  private loadLogo(): void {
    const img = new Image();
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
        },
        error: () => {
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

  async exportPDF(): Promise<void> {
    if (!this.dateFrom || !this.dateTo || this.exporting) return;

    this.exporting = true;

    try {
      const dateFromStr = this.formatDateForApi(this.dateFrom);
      const dateToStr = this.formatDateForApi(this.dateTo);

      const [settingsData, firstPage] = await Promise.all([
        firstValueFrom(this.apiService.get<{ tax: number | null }>('/settings')),
        firstValueFrom(
          this.apiService.get<WalleeResponse>(
            `/reports/z-report?dateFrom=${dateFromStr}&dateTo=${dateToStr}&offset=0`
          )
        ),
      ]);

      const allTransactions: WalleeTransaction[] = [...firstPage.data];
      let offset = this.pageSize;
      let hasMore = firstPage.hasMore;

      while (hasMore) {
        const page = await firstValueFrom(
          this.apiService.get<WalleeResponse>(
            `/reports/z-report?dateFrom=${dateFromStr}&dateTo=${dateToStr}&offset=${offset}`
          )
        );
        allTransactions.push(...page.data);
        hasMore = page.hasMore;
        offset += this.pageSize;
      }

      const taxRate: number | null = settingsData.tax ?? null;
      const hasTax = taxRate !== null && taxRate > 0;

      const grossAmount = allTransactions
        .filter((t) => SUCCESS_STATES.includes(t.state?.toUpperCase()))
        .reduce((sum, t) => sum + (Number(t.authorizationAmount) || 0), 0);

      const netAmount = hasTax
        ? grossAmount - grossAmount * (taxRate! / 100)
        : null;

      const currency = allTransactions[0]?.currency || '';

      const doc = new jsPDF('portrait');
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
      const title = 'Z-Report';
      doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      const sameDay =
        this.formatDisplayDate(this.dateFrom) === this.formatDisplayDate(this.dateTo);
      const dateLabel = sameDay
        ? `Date: ${this.formatDisplayDate(this.dateFrom)}`
        : `Period: ${this.formatDisplayDate(this.dateFrom)} \u2013 ${this.formatDisplayDate(this.dateTo)}`;
      doc.text(dateLabel, (pageWidth - doc.getTextWidth(dateLabel)) / 2, yPos);
      yPos += 8;

      const totalCountText = `Total Transactions: ${allTransactions.length}`;
      doc.text(totalCountText, (pageWidth - doc.getTextWidth(totalCountText)) / 2, yPos);
      yPos += 12;

      const transactionRows = allTransactions.map((item) => [
        item.id?.toString() || '-',
        this.formatCreatedOn(item.createdOn),
        item.metaData?.customerName || '-',
        [item.metaData?.carBrand, item.metaData?.plateNo].filter(Boolean).join(' - ') || '-',
        this.formatAmount(item.authorizationAmount, item.currency),
        this.getStatusLabel(item.state),
      ]);

      const footerStartIndex = transactionRows.length;
      const tableBody: string[][] = [...transactionRows];

      if (hasTax) {
        tableBody.push(['Gross Amount', '', '', '', `${currency} ${grossAmount.toFixed(2)}`, '']);
        tableBody.push(['Tax %', '', '', '', `${taxRate}%`, '']);
        tableBody.push(['Net Amount', '', '', '', `${currency} ${netAmount!.toFixed(2)}`, '']);
      } else {
        tableBody.push(['Net Amount', '', '', '', `${currency} ${grossAmount.toFixed(2)}`, '']);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Transaction ID', 'Date', 'Full Name', 'Car Details', 'Amount', 'Status']],
        body: tableBody,
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
        columnStyles: {
          0: { cellWidth: 25 },
          4: { halign: 'right' },
        },
        margin: { left: 10, right: 10 },
        didParseCell: (data: any) => {
          if (data.section !== 'body') return;

          if (data.row.index >= footerStartIndex) {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.textColor = [0, 107, 143];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 8;
            if (data.row.index === footerStartIndex) {
              data.cell.styles.lineWidth = { top: 0.5, bottom: 0, left: 0, right: 0 };
              data.cell.styles.lineColor = [0, 107, 143];
            }
          } else if (data.column.index === 5) {
            const state = allTransactions[data.row.index]?.state?.toUpperCase();
            if (FAILED_STATES.includes(state)) {
              data.cell.styles.textColor = [220, 38, 38];
            } else if (SUCCESS_STATES.includes(state)) {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        },
      });

      const fileSuffix = sameDay
        ? dateFromStr
        : `${dateFromStr}-to-${dateToStr}`;
      doc.save(`z-report-${fileSuffix}.pdf`);
    } catch (err) {
      console.error('Error exporting Z-Report PDF:', err);
    } finally {
      this.exporting = false;
    }
  }

  formatCreatedOn(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  formatAmount(amount: number, currency: string): string {
    if (amount == null) return '-';
    return `${currency} ${Number(amount).toFixed(2)}`;
  }

  getStatusClass(state: string): string {
    switch (state?.toUpperCase()) {
      case 'FULFILL': return 'status-fulfill';
      case 'FAILED': return 'status-failed';
      case 'AUTHORIZED': return 'status-authorized';
      case 'CONFIRMED': return 'status-confirmed';
      case 'PROCESSING': return 'status-processing';
      case 'VOIDED': return 'status-voided';
      default: return 'status-default';
    }
  }

  getStatusLabel(state: string): string {
    if (!state) return '-';
    return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
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
