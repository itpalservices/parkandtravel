import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { RoleService } from '../../core/services/role.service';
import { AdminXReportData } from '../../shared/models/reports.model';
import { ShiftSummary } from '../../shared/models/shifts.model';
import { formatPaymentMethodLabel, formatSignedCurrency } from '../../shared/utils/payment-method-format.util';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-x-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './x-report.component.html',
  styleUrl: './x-report.component.scss',
})
export class XReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private roleService = inject(RoleService);
  private router = inject(Router);

  loading = false;
  exporting = false;
  isDriver = false;
  isAdmin = false;

  /** Admin view: one section per employee (including the admin) who currently has an open
   *  shift — oldest open shift first. Gone from the list the moment that shift is closed. */
  adminSummary: AdminXReportData | null = null;

  /** Driver view: a live read of their own currently-open shift, identical to the logout
   *  modal — empty the moment that shift is closed. */
  driverSummary: ShiftSummary | null = null;

  private expandedUserIds = new Set<string>();

  formatMethod = formatPaymentMethodLabel;
  formatAmount = formatSignedCurrency;

  ngOnInit(): void {
    this.roleService.getUserRole().pipe(take(1)).subscribe((roleInfo) => {
      this.isDriver = roleInfo.isDriver;
      this.isAdmin = roleInfo.isAdmin;
      this.load();
    });
  }

  private load(): void {
    this.loading = true;
    if (this.isDriver) {
      this.apiService.get<ShiftSummary>('/reports/x-report').subscribe({
        next: (res) => {
          this.driverSummary = res;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
    } else {
      this.apiService.get<AdminXReportData>('/reports/x-report').subscribe({
        next: (res) => {
          this.adminSummary = res;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
    }
  }

  get driverTransactions() {
    return this.driverSummary?.transactions ?? [];
  }

  get driverGrandTotal(): number {
    return this.driverSummary?.totals.reduce((sum, t) => sum + t.total, 0) ?? 0;
  }

  get hasTransactions(): boolean {
    if (this.isDriver) return this.driverTransactions.length > 0;
    return (this.adminSummary?.employees.length ?? 0) > 0;
  }

  isExpanded(userId: string): boolean {
    return this.expandedUserIds.has(userId);
  }

  toggleExpanded(userId: string): void {
    if (this.expandedUserIds.has(userId)) {
      this.expandedUserIds.delete(userId);
    } else {
      this.expandedUserIds.add(userId);
    }
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  goBack(): void {
    this.router.navigate(['/admin/bookings']);
  }

  exportPDF(): void {
    if (this.isDriver) {
      this.exportDriverPDF();
    }
    // Admin export intentionally not implemented yet for the new per-employee view —
    // the button is hidden for admins until that's asked for.
  }

  private exportDriverPDF(): void {
    if (!this.driverSummary || this.driverTransactions.length === 0) return;
    this.exporting = true;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 107, 143);
    const title = 'X Report — Current Shift';
    doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const dateText = `Generated: ${new Date().toLocaleString('en-GB')}`;
    doc.text(dateText, (pageWidth - doc.getTextWidth(dateText)) / 2, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Grand Total: ${this.formatAmount(this.driverGrandTotal)}`, 14, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Booking Ref.', 'Plate', 'Method', 'Amount']],
      body: this.driverTransactions.map(t => [
        this.formatDate(t.datetime),
        t.type === 'checkin' ? 'Check-in' : 'Check-out',
        t.bookingReference || '-',
        t.plateNo || '-',
        this.formatMethod(t.paymentMethod),
        this.formatAmount(t.amount),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 107, 143], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 10, right: 10 },
    });

    doc.save(`x-report-shift-${new Date().toISOString().slice(0, 10)}.pdf`);
    this.exporting = false;
  }
}
