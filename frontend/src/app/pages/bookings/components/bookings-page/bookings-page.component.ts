import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgbDatepickerModule, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { BookingsService } from '../../../../core/services/bookings.service';
import { Booking } from '../../../../shared/models/booking.model';
import {
  DateRangePickerComponent,
  DateRange,
} from '../../../../shared/components/date-range-picker/date-range-picker.component';
import { BookingsListComponent } from '../bookings-list/bookings-list.component';
import { RoleService, UserRoleInfo } from '../../../../core/services/role.service';
import { take } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-bookings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NgbDatepickerModule,
    DateRangePickerComponent,
    BookingsListComponent,
  ],
  templateUrl: './bookings-page.component.html',
  styleUrls: ['./bookings-page.component.scss'],
})
export class BookingsPageComponent implements OnInit {
  allBookings: Booking[] = [];
  filteredBookings: Booking[] = [];
  loading = false;
  errorMessage = '';
  searchTerm = '';

  isAdmin: boolean = false;
  isDriver: boolean = false;
  verifiedEmail: boolean | undefined = false;

  dateFilter: DateRange = { from: null, to: null, preset: null };
  dateRangeFilterForList: { dateFrom: string | null; dateTo: string | null } = { dateFrom: null, dateTo: null };
  filterBy: 'check-ins' | 'check-outs' | 'both' = 'check-ins';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(
    private bookingsService: BookingsService,
    private calendar: NgbCalendar,
    private roleService: RoleService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.initDefaultDateRange();
    this.loadBookings();
    this.checkUserRole();
    this.checkEmailVerification();
  }

  private initDefaultDateRange(): void {
    const today = this.calendar.getToday();
    const fromDate = new Date(today.year, today.month - 1, today.day);
    const toDate = new Date(today.year, today.month - 1, today.day);

    this.dateFilter = {
      from: fromDate,
      to: toDate,
      preset: 'today',
    };
    this.updateDateRangeFilterForList();
  }

  private updateDateRangeFilterForList(): void {
    this.dateRangeFilterForList = {
      dateFrom: this.dateFilter.from ? this.formatDateForApi(this.dateFilter.from) : null,
      dateTo: this.dateFilter.to ? this.formatDateForApi(this.dateFilter.to) : null,
    };
  }

  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadBookings(): void {
    this.loading = true;
    this.errorMessage = '';

    const params: { dateFrom?: string; dateTo?: string; filterBy?: 'check-ins' | 'check-outs' | 'both' } = {};

    if (this.dateFilter.from) {
      params.dateFrom = this.formatDateForApi(this.dateFilter.from);
    }
    if (this.dateFilter.to) {
      params.dateTo = this.formatDateForApi(this.dateFilter.to);
    }
    params.filterBy = this.filterBy;

    this.bookingsService.getBookings(params).subscribe({
      next: (response) => {
        this.allBookings = response.data;
        this.applySearchFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load bookings:', err);
        this.errorMessage = err.message || 'Failed to load bookings. Please try again.';
        this.loading = false;
      },
    });
  }

  private applySearchFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredBookings = [...this.allBookings];
    } else {
      this.filteredBookings = this.allBookings.filter((booking) => {
        const fullName = `${booking.name} ${booking.surname}`.toLowerCase();
        const searchableFields = [
          fullName,
          booking.email,
          booking.phone,
          booking.mobile,
          booking.plateNo,
          booking.returnFlight,
          booking.parkingType,
          booking.dateFrom,
          booking.dateTo,
          booking.carBrand,
          booking.carModel,
          booking.carColor,
        ];

        return searchableFields.some((field) => field && field.toLowerCase().includes(term));
      });
    }

    this.totalPages = Math.ceil(this.filteredBookings.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFilter = range;
    this.updateDateRangeFilterForList();
    this.loadBookings();
  }

  get paginatedBookings(): Booking[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredBookings.slice(start, end);
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;

    if (this.totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (this.currentPage > 3) {
        pages.push(-1);
      }

      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(this.totalPages - 1, this.currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (this.currentPage < this.totalPages - 2) {
        pages.push(-1);
      }

      pages.push(this.totalPages);
    }

    return pages;
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onSearchChange(): void {
    this.applySearchFilter();
  }

  onFilterByChange(filter: 'check-ins' | 'check-outs' | 'both'): void {
    if (this.filterBy !== filter) {
      this.filterBy = filter;
      this.loadBookings();
    }
  }

  private checkUserRole(): void {
    this.roleService.getUserRole().subscribe({
      next: (roleInfo: UserRoleInfo) => {
        this.isDriver = roleInfo.isDriver;
        this.isAdmin = roleInfo.isAdmin;
      },
    });
  }

  private checkEmailVerification() {
    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.verifiedEmail = user.email_verified;
      }
    });
  }
}
