import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ZebraPrintService } from '../../../core/services/zebra-print.service';
import { ApiService } from '../../../core/services/api.service';
import { ZReportData } from '../../../shared/models/reports.model';
import { ZReportSummaryComponent } from '../../../shared/components/z-report-summary/z-report-summary.component';
import { formatPaymentMethodLabel, formatSignedCurrency } from '../../../shared/utils/payment-method-format.util';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToExcel } from '../../../shared/utils/excel-export.util';

const REPORT_COLUMNS = ['Date', 'Employee', 'Booking Ref.', 'Plate', 'Type', 'Method', 'Amount'];

@Component({
  selector: 'app-z-report-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbDropdownModule, ZReportSummaryComponent],
  templateUrl: './z-report-detail.component.html',
  styleUrl: './z-report-detail.component.scss',
})
export class ZReportDetailComponent implements OnInit {
  private apiService = inject(ApiService);
  private zebraPrint = inject(ZebraPrintService);
  private route = inject(ActivatedRoute);

  loading = false;
  exporting = false;
  printing = false;
  report: ZReportData | null = null;

  formatMethod = formatPaymentMethodLabel;
  formatAmount = formatSignedCurrency;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.loading = true;
    this.apiService.get<ZReportData>(`/reports/z-report-new/${id}`).subscribe({
      next: (data) => {
        this.report = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private flattenRows(): string[][] {
    if (!this.report) return [];
    const rows: string[][] = [];
    this.report.employees.forEach((emp) => {
      emp.transactions.forEach((t) => {
        rows.push([
          this.formatDateTime(t.datetime),
          emp.employeeName,
          t.bookingReference || '-',
          t.plateNo || '-',
          t.type === 'checkin' ? 'Check-in' : 'Check-out',
          this.formatMethod(t.paymentMethod),
          this.formatAmount(t.amount),
        ]);
      });
    });
    return rows;
  }

  /** Thermal slip: grand totals only. Failures surface through the shared print-progress popup. */
  async printThermal(): Promise<void> {
    if (!this.report || this.printing) return;
    this.printing = true;
    try {
      await this.zebraPrint.printZReport(this.report.id);
    } finally {
      this.printing = false;
    }
  }

  exportPDF(): void {
    if (!this.report) return;
    this.exporting = true;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 107, 143);
    const title = 'Z Report';
    doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const sub = `Run by: ${this.report.runByUserName}   |   ${this.formatDateTime(this.report.createdAt)}`;
    doc.text(sub, (pageWidth - doc.getTextWidth(sub)) / 2, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    let xCursor = 14;
    this.report.grandTotals.forEach((t) => {
      const label = `${this.formatMethod(t.paymentMethod)}: ${this.formatAmount(t.total)}`;
      doc.text(label, xCursor, y);
      xCursor += doc.getTextWidth(label) + 10;
    });
    y += 6;
    doc.setTextColor(0, 107, 143);
    doc.text(`Net: ${this.formatAmount(this.report.grandNet)}   |   VAT (${this.report.vatRate}%): ${this.formatAmount(this.report.grandVat)}   |   Grand Total (Gross): ${this.formatAmount(this.report.grandTotal)}`, 14, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [REPORT_COLUMNS],
      body: this.flattenRows(),
      theme: 'striped',
      headStyles: { fillColor: [0, 107, 143], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 10, right: 10 },
    });

    doc.save(`z-report-${new Date(this.report.createdAt).toISOString().slice(0, 10)}.pdf`);
    this.exporting = false;
  }

  async exportExcel(): Promise<void> {
    if (!this.report || this.exporting) return;
    this.exporting = true;
    try {
      const infoLines = [
        `Run by: ${this.report.runByUserName}   |   ${this.formatDateTime(this.report.createdAt)}`,
        `Employees: ${this.report.employees.length}`,
        'Totals by payment method:',
        ...this.report.grandTotals.map((t) => `${this.formatMethod(t.paymentMethod)}: ${this.formatAmount(t.total)} (${t.count} tx)`),
        `Net Amount (excl. VAT): ${this.formatAmount(this.report.grandNet)}`,
        `VAT (${this.report.vatRate}%): ${this.formatAmount(this.report.grandVat)}`,
        `Grand Total (Gross): ${this.formatAmount(this.report.grandTotal)}`,
      ];

      await exportToExcel({
        fileName: `z-report-${new Date(this.report.createdAt).toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Z-Report',
        title: 'Z Report',
        infoLines,
        columns: REPORT_COLUMNS,
        rows: this.flattenRows(),
      });
    } finally {
      this.exporting = false;
    }
  }
}
