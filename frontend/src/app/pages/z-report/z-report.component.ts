import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ZReportData } from '../../shared/models/reports.model';
import { ZReportSummaryComponent } from '../../shared/components/z-report-summary/z-report-summary.component';
import { formatPaymentMethodLabel, formatSignedCurrency } from '../../shared/utils/payment-method-format.util';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PRIMARY_COLOR } from '../../shared/constants/theme.constants';

type Step = 'confirming' | 'result';

@Component({
  selector: 'app-z-report',
  standalone: true,
  imports: [CommonModule, ZReportSummaryComponent],
  templateUrl: './z-report.component.html',
  styleUrl: './z-report.component.scss',
})
export class ZReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  step: Step = 'confirming';
  submitting = false;
  exporting = false;
  result: ZReportData | null = null;

  formatMethod = formatPaymentMethodLabel;
  formatAmount = formatSignedCurrency;

  ngOnInit(): void {
    this.confirmAndCreate();
  }

  private async confirmAndCreate(): Promise<void> {
    const confirmResult = await Swal.fire({
      title: 'Create Z Report',
      html: `
        <p style="margin-bottom:12px;">This will permanently close out every check-in/checkout transaction whose shift has ended and hasn't been reported yet across every employee.</p>
        <p style="font-size:0.85rem;color:#ef4444;">This action cannot be undone. Transactions still tied to an open shift are left untouched.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Confirm & Create',
      cancelButtonText: 'Cancel',
      confirmButtonColor: PRIMARY_COLOR,
      cancelButtonColor: '#6c757d',
      allowOutsideClick: false,
    });

    if (!confirmResult.isConfirmed) {
      this.goBack();
      return;
    }

    this.submit();
  }

  private submit(): void {
    this.submitting = true;
    this.apiService.post<ZReportData>('/reports/z-report-new', {}).subscribe({
      next: (data) => {
        this.result = data;
        this.step = 'result';
        this.submitting = false;
      },
      error: (err) => {
        this.submitting = false;
        const message = err?.error?.error || 'Failed to create Z report. Please try again.';
        Swal.fire({ icon: 'error', title: 'Error', text: message }).then(() => this.goBack());
      },
    });
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/bookings']);
  }

  viewHistory(): void {
    this.router.navigate(['/admin/reports/z-reports']);
  }

  exportPDF(): void {
    if (!this.result) return;
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
    const sub = `Run by: ${this.result.runByUserName}   |   ${this.formatDateTime(this.result.createdAt)}`;
    doc.text(sub, (pageWidth - doc.getTextWidth(sub)) / 2, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    let xCursor = 14;
    this.result.grandTotals.forEach((t) => {
      const label = `${this.formatMethod(t.paymentMethod)}: ${this.formatAmount(t.total)}`;
      doc.text(label, xCursor, y);
      xCursor += doc.getTextWidth(label) + 10;
    });
    y += 6;
    doc.setTextColor(0, 107, 143);
    doc.text(`Grand Total: ${this.formatAmount(this.result.grandTotal)}`, 14, y);
    y += 10;

    const rows: string[][] = [];
    this.result.employees.forEach((emp) => {
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

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Employee', 'Booking Ref.', 'Plate', 'Type', 'Method', 'Amount']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [0, 107, 143], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 10, right: 10 },
    });

    doc.save(`z-report-${new Date(this.result.createdAt).toISOString().slice(0, 10)}.pdf`);
    this.exporting = false;
  }
}
