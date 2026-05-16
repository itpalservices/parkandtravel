import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../../../core/services/api.service';
import { DateRangePickerComponent, DateRange } from '../../../shared/components/date-range-picker/date-range-picker.component';

export interface EmployeeInfo {
  userId: string;
  name: string;
  shiftCount: number;
}

export interface ShiftInfo {
  id: number;
  userId: string;
  shiftStart: string;
  shiftEnd: string | null;
  lastActivityAt: string;
  status: string;
  createdAt: string;
}

export interface PaymentTotals {
  paymentMethod: string;
  total: number;
  count: number;
}

export interface TransactionRow {
  id: string;
  datetime: string;
  amount: number;
  userId: string;
  paymentMethod: string;
  notes: string | null;
  plateNo: string | null;
  type: 'checkout' | 'checkin';
  employeeName?: string;
}

export interface TransactionsResponse {
  transactions: TransactionRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  totals: PaymentTotals[];
}

type Mode = 'date' | 'employee';
type EmployeeStep = 'employees' | 'shifts' | 'transactions';

@Component({
  selector: 'app-employee-session-report',
  standalone: true,
  imports: [CommonModule, RouterLink, DateRangePickerComponent],
  templateUrl: './employee-session-report.component.html',
  styleUrl: './employee-session-report.component.scss',
})
export class EmployeeSessionReportComponent implements OnInit {
  private calendar = inject(NgbCalendar);
  private apiService = inject(ApiService);

  mode: Mode = 'date';

  // --- Date mode state ---
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  dateData: TransactionsResponse | null = null;
  dateLoading = false;
  dateError: string | null = null;
  datePage = 1;

  // --- Employee mode state ---
  employeeStep: EmployeeStep = 'employees';
  employees: EmployeeInfo[] = [];
  employeesLoading = false;
  employeesError: string | null = null;

  selectedEmployee: EmployeeInfo | null = null;
  shifts: ShiftInfo[] = [];
  shiftsLoading = false;

  // --- Shifts date filter ---
  shiftsDateFrom: Date | null = null;
  shiftsDateTo: Date | null = null;

  selectedShift: ShiftInfo | null = null;
  shiftData: TransactionsResponse | null = null;
  shiftLoading = false;
  shiftError: string | null = null;
  shiftPage = 1;

  // --- Export state ---
  exporting = false;
  private logoBase64 = '';

  ngOnInit(): void {
    const today = this.calendar.getToday();
    const todayDate = new Date(today.year, today.month - 1, today.day);
    this.dateFrom = todayDate;
    this.dateTo = todayDate;
    this.shiftsDateFrom = todayDate;
    this.shiftsDateTo = todayDate;
    this.loadLogo();
    this.loadDateReport();
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

  // ===================== MODE TOGGLE =====================
  setMode(m: Mode): void {
    this.mode = m;
    if (m === 'date' && !this.dateData) {
      this.loadDateReport();
    }
    if (m === 'employee' && this.employees.length === 0) {
      this.loadEmployees();
    }
  }

  // ===================== DATE MODE =====================
  onDateRangeChange(range: DateRange): void {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.datePage = 1;
    this.loadDateReport();
  }

  loadDateReport(): void {
    if (!this.dateFrom || !this.dateTo) return;
    this.dateLoading = true;
    this.dateError = null;
    const from = this.formatDateTimeForApi(this.dateFrom);
    const to = this.formatDateTimeForApi(this.dateTo);
    this.apiService
      .get<TransactionsResponse>(`/reports/employee-session/by-date?dateFrom=${from}&dateTo=${to}&page=${this.datePage}`)
      .subscribe({
        next: (data) => {
          this.dateData = data;
          this.dateLoading = false;
        },
        error: () => {
          this.dateError = 'Failed to load report. Please try again.';
          this.dateLoading = false;
        },
      });
  }

  onDatePrevious(): void {
    if (this.datePage > 1) { this.datePage--; this.loadDateReport(); }
  }

  onDateNext(): void {
    if (this.dateData && this.datePage < this.dateData.totalPages) { this.datePage++; this.loadDateReport(); }
  }

  onDatePageChange(p: number): void { this.datePage = p; this.loadDateReport(); }

  // ===================== EMPLOYEE MODE =====================
  loadEmployees(): void {
    this.employeesLoading = true;
    this.employeesError = null;
    this.apiService.get<EmployeeInfo[]>('/reports/employee-session/employees').subscribe({
      next: (data) => { this.employees = data; this.employeesLoading = false; },
      error: () => { this.employeesError = 'Failed to load employees. Please try again.'; this.employeesLoading = false; },
    });
  }

  onShiftsDateRangeChange(range: DateRange): void {
    this.shiftsDateFrom = range.from;
    this.shiftsDateTo = range.to;
  }

  get filteredShifts(): ShiftInfo[] {
    if (!this.shiftsDateFrom || !this.shiftsDateTo) return this.shifts;

    const rangeStart = new Date(this.shiftsDateFrom);
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(this.shiftsDateTo);
    rangeEnd.setHours(23, 59, 59, 999);

    return this.shifts.filter(shift => {
      const start = new Date(shift.shiftStart);
      const end = shift.shiftEnd ? new Date(shift.shiftEnd) : null;
      if (start > rangeEnd) return false;
      if (end && end < rangeStart) return false;
      return true;
    });
  }

  get totalShiftsTime(): string {
    if (!this.shiftsDateFrom || !this.shiftsDateTo) return '0h 0m';

    const rangeStart = new Date(this.shiftsDateFrom);
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(this.shiftsDateTo);
    rangeEnd.setHours(23, 59, 59, 999);

    const totalMinutes = this.filteredShifts
      .filter(s => s.status === 'closed' && s.shiftEnd)
      .reduce((sum, shift) => {
        const start = new Date(shift.shiftStart);
        const end = new Date(shift.shiftEnd!);
        const clampedStart = start < rangeStart ? rangeStart : start;
        const clampedEnd = end > rangeEnd ? rangeEnd : end;
        const durationMs = clampedEnd.getTime() - clampedStart.getTime();
        return sum + (durationMs > 0 ? Math.floor(durationMs / 60000) : 0);
      }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }

  selectEmployee(emp: EmployeeInfo): void {
    this.selectedEmployee = emp;
    this.employeeStep = 'shifts';
    this.shifts = [];
    this.shiftsLoading = true;
    this.apiService
      .get<ShiftInfo[]>(`/reports/employee-session/employees/${encodeURIComponent(emp.userId)}/shifts`)
      .subscribe({
        next: (data) => { this.shifts = data; this.shiftsLoading = false; },
        error: () => { this.shiftsLoading = false; },
      });
  }

  selectShift(shift: ShiftInfo): void {
    this.selectedShift = shift;
    this.employeeStep = 'transactions';
    this.shiftPage = 1;
    this.loadShiftTransactions();
  }

  loadShiftTransactions(): void {
    if (!this.selectedShift) return;
    this.shiftLoading = true;
    this.shiftError = null;
    this.apiService
      .get<TransactionsResponse>(`/reports/employee-session/shifts/${this.selectedShift.id}/transactions?page=${this.shiftPage}`)
      .subscribe({
        next: (data) => { this.shiftData = data; this.shiftLoading = false; },
        error: () => { this.shiftError = 'Failed to load transactions. Please try again.'; this.shiftLoading = false; },
      });
  }

  onShiftPrevious(): void {
    if (this.shiftPage > 1) { this.shiftPage--; this.loadShiftTransactions(); }
  }

  onShiftNext(): void {
    if (this.shiftData && this.shiftPage < this.shiftData.totalPages) { this.shiftPage++; this.loadShiftTransactions(); }
  }

  onShiftPageChange(p: number): void { this.shiftPage = p; this.loadShiftTransactions(); }

  backToEmployees(): void {
    this.employeeStep = 'employees';
    this.selectedEmployee = null;
    this.selectedShift = null;
    this.shiftData = null;
  }

  backToShifts(): void {
    this.employeeStep = 'shifts';
    this.selectedShift = null;
    this.shiftData = null;
  }

  // ===================== PDF EXPORT =====================
  async exportPDF(): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    try {
      if (this.mode === 'date') {
        await this.exportDatePDF();
      } else {
        await this.exportShiftPDF();
      }
    } finally {
      this.exporting = false;
    }
  }

  private async exportDatePDF(): Promise<void> {
    if (!this.dateFrom || !this.dateTo) return;
    const fromApi = this.formatDateTimeForApi(this.dateFrom);
    const toApi = this.formatDateTimeForApi(this.dateTo);
    const from = this.formatDateForApi(this.dateFrom);
    const to = this.formatDateForApi(this.dateTo);

    const all: TransactionRow[] = [];
    let totals: PaymentTotals[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const data = await firstValueFrom(
        this.apiService.get<TransactionsResponse>(`/reports/employee-session/by-date?dateFrom=${fromApi}&dateTo=${toApi}&page=${page}`)
      );
      all.push(...data.transactions);
      totals = data.totals;
      hasMore = page < data.totalPages;
      page++;
    }

    const sameDay = from === to;
    const periodLabel = sameDay
      ? `Date: ${this.formatDisplayDate(this.dateFrom!)}`
      : `Period: ${this.formatDisplayDate(this.dateFrom!)} – ${this.formatDisplayDate(this.dateTo!)}`;
    const filename = sameDay
      ? `z-report-by-employee-${from}.pdf`
      : `z-report-by-employee-${from}-to-${to}.pdf`;

    const rows = all.map((t) => [
      this.formatDateTime(t.datetime),
      t.plateNo || '-',
      this.formatTxType(t.type),
      this.formatPaymentMethod(t.paymentMethod),
      this.formatAmount(t.amount),
      t.employeeName || '-',
      t.notes || '-',
    ]);

    this.buildPDF({
      title: 'Income by Employee',
      subtitle: periodLabel,
      headers: ['Date / Time', 'Plate No', 'Type', 'Payment Method', 'Amount', 'Employee', 'Notes'],
      rows,
      totals,
      total: all.length,
      filename,
      colStyles: { 4: { halign: 'right' as const }, 6: { cellWidth: 40 } },
    });
  }

  private async exportShiftPDF(): Promise<void> {
    if (!this.selectedShift || !this.selectedEmployee) return;

    const all: TransactionRow[] = [];
    let totals: PaymentTotals[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const data = await firstValueFrom(
        this.apiService.get<TransactionsResponse>(`/reports/employee-session/shifts/${this.selectedShift.id}/transactions?page=${page}`)
      );
      all.push(...data.transactions);
      totals = data.totals;
      hasMore = page < data.totalPages;
      page++;
    }

    const shiftStart = new Date(this.selectedShift.shiftStart);
    const shiftStartStr = this.formatDateForApi(shiftStart);
    const shiftEnd = this.selectedShift.shiftEnd
      ? this.formatDateTime(this.selectedShift.shiftEnd)
      : 'Ongoing';
    const periodLabel = `Employee: ${this.selectedEmployee.name} | Shift: ${this.formatDateTime(this.selectedShift.shiftStart)} → ${shiftEnd}`;
    const safeName = this.selectedEmployee.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `z-report-by-employee-${safeName}-shift-${shiftStartStr}.pdf`;

    const rows = all.map((t) => [
      this.formatDateTime(t.datetime),
      t.plateNo || '-',
      this.formatTxType(t.type),
      this.formatPaymentMethod(t.paymentMethod),
      this.formatAmount(t.amount),
      t.notes || '-',
    ]);

    this.buildPDF({
      title: 'Income by Employee',
      subtitle: periodLabel,
      headers: ['Date / Time', 'Plate No', 'Type', 'Payment Method', 'Amount', 'Notes'],
      rows,
      totals,
      total: all.length,
      filename,
      colStyles: { 4: { halign: 'right' as const }, 5: { cellWidth: 40 } },
    });
  }

  private buildPDF(opts: {
    title: string;
    subtitle: string;
    headers: string[];
    rows: string[][];
    totals: PaymentTotals[];
    total: number;
    filename: string;
    colStyles?: Record<number, any>;
  }): void {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 14;

    if (this.logoBase64) {
      const logoW = 45, logoH = 18;
      doc.addImage(this.logoBase64, 'PNG', (pageWidth - logoW) / 2, yPos, logoW, logoH);
      yPos += logoH + 8;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 107, 143);
    doc.text(opts.title, (pageWidth - doc.getTextWidth(opts.title)) / 2, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(opts.subtitle, (pageWidth - doc.getTextWidth(opts.subtitle)) / 2, yPos);
    yPos += 6;

    const totalText = `Total Transactions: ${opts.total}`;
    doc.text(totalText, (pageWidth - doc.getTextWidth(totalText)) / 2, yPos);
    yPos += 10;

    // Totals summary block
    const totalsX = 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 107, 143);
    doc.text('Payment Summary:', totalsX, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    let xCursor = totalsX;
    const grand = this.grandTotal(opts.totals);
    opts.totals.forEach((t) => {
      const label = `${this.formatPaymentMethod(t.paymentMethod)}: ${this.formatAmount(t.total)} (${t.count} tx)`;
      doc.text(label, xCursor, yPos);
      xCursor += doc.getTextWidth(label) + 10;
    });
    if (opts.totals.length > 0) {
      const grandLabel = `Grand Total: ${this.formatAmount(grand)}`;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 107, 143);
      doc.text(grandLabel, xCursor, yPos);
    }
    yPos += 10;

    const tableBody = [...opts.rows];

    autoTable(doc, {
      startY: yPos,
      head: [opts.headers],
      body: tableBody,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 107, 143],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 7.5, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: opts.colStyles,
      margin: { left: 14, right: 14 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const footerText = `Page ${i} of ${pageCount} — Generated on ${this.formatDateTime(new Date().toISOString())}`;
      doc.text(footerText, (pageWidth - doc.getTextWidth(footerText)) / 2, doc.internal.pageSize.getHeight() - 8);
    }

    doc.save(opts.filename);
  }

  // ===================== PAGINATION HELPERS =====================
  getPageNumbers(currentPage: number, totalPages: number): (number | -1)[] {
    const pages: (number | -1)[] = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push(-1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push(-1);
      pages.push(totalPages);
    }
    return pages;
  }

  // ===================== FORMATTING HELPERS =====================
  formatDateForApi(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateTimeForApi(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  formatDisplayDate(d: Date): string {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDateTime(dt: string): string {
    return new Date(dt).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatAmount(amount: number): string {
    return `€${amount.toFixed(2)}`;
  }

  formatPaymentMethod(m: string): string {
    if (!m) return '-';
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  }

  formatTxType(type: string): string {
    return type === 'checkin' ? 'Check-in' : 'Check-out';
  }

  grandTotal(totals: PaymentTotals[]): number {
    return totals.reduce((sum, t) => sum + t.total, 0);
  }

  shiftDuration(shift: ShiftInfo): string {
    const start = new Date(shift.shiftStart);
    const end = shift.shiftEnd ? new Date(shift.shiftEnd) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  }

  get canExport(): boolean {
    if (this.mode === 'date') return !!this.dateData && this.dateData.total > 0;
    return !!this.shiftData && this.shiftData.total > 0;
  }
}
