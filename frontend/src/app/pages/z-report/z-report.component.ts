import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ZReportEmployee, ZReportData, XReportTransaction } from '../../shared/models/reports.model';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PRIMARY_COLOR } from '../../shared/constants/theme.constants';

type Step = 'form' | 'result';

@Component({
  selector: 'app-z-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './z-report.component.html',
  styleUrl: './z-report.component.scss',
})
export class ZReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  step: Step = 'form';
  loadingEmployees = false;
  submitting = false;
  exporting = false;

  employees: ZReportEmployee[] = [];
  selectedUserId = '';
  declaredCash: number | null = null;
  declaredCard: number | null = null;

  result: ZReportData | null = null;

  ngOnInit(): void {
    this.loadEmployees();
  }

  private loadEmployees(): void {
    this.loadingEmployees = true;
    this.apiService.get<ZReportEmployee[]>('/reports/z-report-new/employees').subscribe({
      next: (list) => {
        this.employees = list;
        this.loadingEmployees = false;
      },
      error: () => {
        this.loadingEmployees = false;
      },
    });
  }

  get selectedEmployee(): ZReportEmployee | undefined {
    return this.employees.find(e => e.userId === this.selectedUserId);
  }

  get selectedEmployeeFullName(): string {
    const e = this.selectedEmployee;
    return e ? `${e.name} ${e.surname}`.trim() || e.email : '';
  }

  get isFormValid(): boolean {
    return !!this.selectedUserId && this.declaredCash !== null && this.declaredCard !== null && this.declaredCash >= 0 && this.declaredCard >= 0;
  }

  proceed(): void {
    if (!this.isFormValid) return;

    const name = this.selectedEmployeeFullName;
    const cash = Number(this.declaredCash).toFixed(2);
    const card = Number(this.declaredCard).toFixed(2);

    Swal.fire({
      title: 'Confirm Z Report',
      html: `
        <p style="margin-bottom:16px;">You are about to close out the following employee:</p>
        <p style="font-weight:700;font-size:1.05rem;margin-bottom:16px;">${name}</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;text-align:left;">Declared Cash</td>
            <td style="padding:6px 0;font-weight:600;text-align:right;">€${cash}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;text-align:left;">Declared Card</td>
            <td style="padding:6px 0;font-weight:600;text-align:right;">€${card}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px 0;font-weight:700;text-align:left;">Total Declared</td>
            <td style="padding:8px 0;font-weight:700;text-align:right;">€${(Number(this.declaredCash) + Number(this.declaredCard)).toFixed(2)}</td>
          </tr>
        </table>
        <p style="margin-top:16px;font-size:0.85rem;color:#ef4444;">This action cannot be undone. All unreported transactions will be flagged.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Confirm & Create',
      cancelButtonText: 'Cancel',
      confirmButtonColor: PRIMARY_COLOR,
      cancelButtonColor: '#6c757d',
    }).then(res => {
      if (res.isConfirmed) {
        this.submit();
      }
    });
  }

  private submit(): void {
    const employee = this.selectedEmployee;
    if (!employee) return;

    this.submitting = true;
    this.apiService.post<ZReportData>('/reports/z-report-new', {
      targetUserId: this.selectedUserId,
      targetUserName: this.selectedEmployeeFullName,
      declaredCash: Number(this.declaredCash),
      declaredCard: Number(this.declaredCard),
    }).subscribe({
      next: (data) => {
        this.result = data;
        this.step = 'result';
        this.submitting = false;
      },
      error: (err) => {
        this.submitting = false;
        const message = err?.error?.error || 'Failed to create Z report. Please try again.';
        Swal.fire({ icon: 'error', title: 'Error', text: message });
      },
    });
  }

  get cashDiff(): number {
    if (!this.result) return 0;
    return parseFloat((this.result.declaredCash - this.result.actualCash).toFixed(2));
  }

  get cardDiff(): number {
    if (!this.result) return 0;
    return parseFloat((this.result.declaredCard - this.result.actualCard).toFixed(2));
  }

  get totalDiff(): number {
    return parseFloat((this.cashDiff + this.cardDiff).toFixed(2));
  }

  get transactions(): XReportTransaction[] {
    return this.result?.transactions ?? [];
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  diffLabel(diff: number): string {
    if (diff === 0) return 'Match';
    return diff > 0 ? `+€${diff.toFixed(2)} surplus` : `-€${Math.abs(diff).toFixed(2)} shortage`;
  }

  diffClass(diff: number): string {
    if (diff === 0) return 'match';
    return diff > 0 ? 'surplus' : 'shortage';
  }

  goBack(): void {
    this.router.navigate(['/admin/bookings']);
  }

  newReport(): void {
    this.step = 'form';
    this.result = null;
    this.selectedUserId = '';
    this.declaredCash = null;
    this.declaredCard = null;
    this.loadEmployees();
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
    const sub = `Employee: ${this.result.targetUserName}   |   Generated by: ${this.result.runByUserName}   |   ${new Date(this.result.createdAt).toLocaleString('en-GB')}`;
    doc.text(sub, (pageWidth - doc.getTextWidth(sub)) / 2, y);
    y += 12;

    autoTable(doc, {
      startY: y,
      head: [['', 'Declared', 'Actual', 'Difference']],
      body: [
        ['Cash', `€${this.result.declaredCash.toFixed(2)}`, `€${this.result.actualCash.toFixed(2)}`, this.diffLabel(this.cashDiff)],
        ['Card', `€${this.result.declaredCard.toFixed(2)}`, `€${this.result.actualCard.toFixed(2)}`, this.diffLabel(this.cardDiff)],
        ['Total', `€${(this.result.declaredCash + this.result.declaredCard).toFixed(2)}`, `€${(this.result.actualCash + this.result.actualCard).toFixed(2)}`, this.diffLabel(this.totalDiff)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 107, 143], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Transactions', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Plate No', 'Type', 'Payment', 'Amount (€)']],
      body: this.transactions.map(t => [
        this.formatDate(t.datetime),
        t.plateNo || '-',
        t.type === 'checkin' ? 'Check-in' : 'Check-out',
        t.paymentMethod,
        Number(t.amount).toFixed(2),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 107, 143], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 10, right: 10 },
    });

    doc.save(`z-report-${this.result.targetUserName.replace(/\s+/g, '-')}-${new Date(this.result.createdAt).toISOString().slice(0, 10)}.pdf`);
    this.exporting = false;
  }
}
