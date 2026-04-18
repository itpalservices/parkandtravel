import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
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
  selector: 'app-employee-z-report',
  standalone: true,
  imports: [CommonModule, RouterLink, DateRangePickerComponent],
  templateUrl: './employee-z-report.component.html',
  styleUrl: './employee-z-report.component.scss',
})
export class EmployeeZReportComponent implements OnInit {
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

  selectedShift: ShiftInfo | null = null;
  shiftData: TransactionsResponse | null = null;
  shiftLoading = false;
  shiftError: string | null = null;
  shiftPage = 1;

  // --- Print state ---
  isPrinting = false;
  printAllTransactions: TransactionRow[] = [];
  printTotals: PaymentTotals[] = [];

  ngOnInit(): void {
    const today = this.calendar.getToday();
    const todayDate = new Date(today.year, today.month - 1, today.day);
    this.dateFrom = todayDate;
    this.dateTo = todayDate;
    this.loadDateReport();
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
    const from = this.formatDateForApi(this.dateFrom);
    const to = this.formatDateForApi(this.dateTo);
    this.apiService
      .get<TransactionsResponse>(`/reports/employee-z/by-date?dateFrom=${from}&dateTo=${to}&page=${this.datePage}`)
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
    if (this.datePage > 1) {
      this.datePage--;
      this.loadDateReport();
    }
  }

  onDateNext(): void {
    if (this.dateData && this.datePage < this.dateData.totalPages) {
      this.datePage++;
      this.loadDateReport();
    }
  }

  onDatePageChange(p: number): void {
    this.datePage = p;
    this.loadDateReport();
  }

  // ===================== EMPLOYEE MODE =====================
  loadEmployees(): void {
    this.employeesLoading = true;
    this.employeesError = null;
    this.apiService.get<EmployeeInfo[]>('/reports/employee-z/employees').subscribe({
      next: (data) => {
        this.employees = data;
        this.employeesLoading = false;
      },
      error: () => {
        this.employeesError = 'Failed to load employees. Please try again.';
        this.employeesLoading = false;
      },
    });
  }

  selectEmployee(emp: EmployeeInfo): void {
    this.selectedEmployee = emp;
    this.employeeStep = 'shifts';
    this.shifts = [];
    this.shiftsLoading = true;
    this.apiService
      .get<ShiftInfo[]>(`/reports/employee-z/employees/${encodeURIComponent(emp.userId)}/shifts`)
      .subscribe({
        next: (data) => {
          this.shifts = data;
          this.shiftsLoading = false;
        },
        error: () => {
          this.shiftsLoading = false;
        },
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
      .get<TransactionsResponse>(`/reports/employee-z/shifts/${this.selectedShift.id}/transactions?page=${this.shiftPage}`)
      .subscribe({
        next: (data) => {
          this.shiftData = data;
          this.shiftLoading = false;
        },
        error: () => {
          this.shiftError = 'Failed to load transactions. Please try again.';
          this.shiftLoading = false;
        },
      });
  }

  onShiftPrevious(): void {
    if (this.shiftPage > 1) {
      this.shiftPage--;
      this.loadShiftTransactions();
    }
  }

  onShiftNext(): void {
    if (this.shiftData && this.shiftPage < this.shiftData.totalPages) {
      this.shiftPage++;
      this.loadShiftTransactions();
    }
  }

  onShiftPageChange(p: number): void {
    this.shiftPage = p;
    this.loadShiftTransactions();
  }

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

  // ===================== PRINT =====================
  async printReport(): Promise<void> {
    if (this.isPrinting) return;
    this.isPrinting = true;

    try {
      if (this.mode === 'date') {
        await this.printDateReport();
      } else {
        await this.printShiftReport();
      }
    } finally {
      this.isPrinting = false;
    }
  }

  private async printDateReport(): Promise<void> {
    if (!this.dateFrom || !this.dateTo) return;
    const from = this.formatDateForApi(this.dateFrom);
    const to = this.formatDateForApi(this.dateTo);
    const all: TransactionRow[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const data = await firstValueFrom(
        this.apiService.get<TransactionsResponse>(
          `/reports/employee-z/by-date?dateFrom=${from}&dateTo=${to}&page=${page}`
        )
      );
      all.push(...data.transactions);
      this.printTotals = data.totals;
      hasMore = page < data.totalPages;
      page++;
    }
    this.printAllTransactions = all;
    setTimeout(() => window.print(), 100);
  }

  private async printShiftReport(): Promise<void> {
    if (!this.selectedShift) return;
    const all: TransactionRow[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const data = await firstValueFrom(
        this.apiService.get<TransactionsResponse>(
          `/reports/employee-z/shifts/${this.selectedShift.id}/transactions?page=${page}`
        )
      );
      all.push(...data.transactions);
      this.printTotals = data.totals;
      hasMore = page < data.totalPages;
      page++;
    }
    this.printAllTransactions = all;
    setTimeout(() => window.print(), 100);
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

  formatDateTime(dt: string): string {
    return new Date(dt).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatDate(dt: string): string {
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

  get printTitle(): string {
    if (this.mode === 'date') {
      if (!this.dateFrom || !this.dateTo) return 'Employee Z-Report';
      const from = this.dateFrom.toLocaleDateString('en-GB');
      const to = this.dateTo.toLocaleDateString('en-GB');
      return from === to ? `Employee Z-Report — ${from}` : `Employee Z-Report — ${from} to ${to}`;
    }
    if (this.selectedShift && this.selectedEmployee) {
      const start = this.formatDate(this.selectedShift.shiftStart);
      return `Employee Z-Report — ${this.selectedEmployee.name} — Shift ${start}`;
    }
    return 'Employee Z-Report';
  }

  get canPrint(): boolean {
    if (this.mode === 'date') {
      return !!this.dateData && this.dateData.total > 0;
    }
    return !!this.shiftData && this.shiftData.total > 0;
  }

  get printedOn(): string {
    return this.formatDateTime(new Date().toISOString());
  }
}
