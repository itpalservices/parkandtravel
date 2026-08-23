import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { NgbCalendar, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { BookingsService } from '../../../../core/services/bookings.service';
import { Booking, BookingSortField, BookingsFilterState } from '../../../../shared/models/booking.model';
import { BookingsListComponent } from '../bookings-list/bookings-list.component';
import { BookingsFilterPanelComponent } from '../bookings-filter-panel/bookings-filter-panel.component';
import { RoleService, UserRoleInfo } from '../../../../core/services/role.service';
import { take } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import {
  buildBookingsPredicate,
  countActiveFilters,
  createDefaultBookingsFilterState,
  filterStateFromQueryParams,
  filterStateToQueryParams,
  sortBookings,
} from '../../../../shared/utils/bookings-filter.util';

@Component({
  selector: 'app-bookings-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
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

  isAdmin: boolean = false;
  isDriver: boolean = false;
  isUser: boolean = false;
  verifiedEmail: boolean | undefined = false;

  customerBookings: Booking[] = [];
  loadingCustomerBookings = false;

  filterState!: BookingsFilterState;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(
    private bookingsService: BookingsService,
    private calendar: NgbCalendar,
    private roleService: RoleService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private offcanvasService: NgbOffcanvas,
  ) {}

  goToXReport(): void {
    this.router.navigate(['/admin/x-report']);
  }

  goToZReport(): void {
    this.router.navigate(['/admin/z-report']);
  }

  ngOnInit(): void {
    const queryParams: Record<string, string | null> = {};
    this.route.snapshot.queryParamMap.keys.forEach((key) => {
      queryParams[key] = this.route.snapshot.queryParamMap.get(key);
    });
    this.filterState = filterStateFromQueryParams(queryParams, this.createDefaultFilterState());

    this.loadBookings();
    this.checkUserRole();
    this.checkEmailVerification();
  }

  private getTodayDateString(): string {
    const today = this.calendar.getToday();
    const month = String(today.month).padStart(2, '0');
    const day = String(today.day).padStart(2, '0');
    return `${today.year}-${month}-${day}`;
  }

  private createDefaultFilterState(): BookingsFilterState {
    const today = this.getTodayDateString();
    return createDefaultBookingsFilterState(today, today, 'today');
  }

  loadBookings(): void {
    this.loading = true;
    this.errorMessage = '';

    const params: { dateFrom?: string; dateTo?: string; filterBy?: 'check-ins' | 'check-outs' | 'both' } = {};
    if (this.filterState.dateFrom) {
      params.dateFrom = this.filterState.dateFrom;
    }
    if (this.filterState.dateTo) {
      params.dateTo = this.filterState.dateTo;
    }
    params.filterBy = 'both';

    this.bookingsService.getBookings(params).subscribe({
      next: (response) => {
        this.allBookings = response.data;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load bookings:', err);
        this.errorMessage = err.message || 'Failed to load bookings. Please try again.';
        this.loading = false;
      },
    });
  }

  /** Re-filters + re-sorts the already-fetched date-range set; no server round-trip. */
  applyFilters(): void {
    const predicate = buildBookingsPredicate(this.filterState);
    const filtered = this.allBookings.filter(predicate);
    this.filteredBookings = sortBookings(filtered, this.filterState.sortField, this.filterState.sortDirection);
    this.totalPages = Math.ceil(this.filteredBookings.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  private syncFiltersToUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filterStateToQueryParams(this.filterState),
      replaceUrl: true,
    });
  }

  get dateRangeLabel(): string {
    if (!this.filterState.dateFrom) return 'All dates';
    const from = this.formatDateForDisplay(this.filterState.dateFrom);
    const to = this.filterState.dateTo ? this.formatDateForDisplay(this.filterState.dateTo) : from;
    return from === to ? from : `${from} - ${to}`;
  }

  private formatDateForDisplay(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  get activeFilterCount(): number {
    return countActiveFilters(this.filterState);
  }

  get dateRangeFilterForList(): { dateFrom: string | null; dateTo: string | null } {
    return { dateFrom: this.filterState.dateFrom, dateTo: this.filterState.dateTo };
  }

  get checkInByOptions(): string[] {
    return this.uniqueSorted(this.allBookings.map((b) => b.checkInBy));
  }

  get checkOutByOptions(): string[] {
    return this.uniqueSorted(this.allBookings.map((b) => b.checkOutBy));
  }

  private uniqueSorted(values: (string | null)[]): string[] {
    return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  }

  openFiltersPanel(): void {
    const ref = this.offcanvasService.open(BookingsFilterPanelComponent, {
      position: 'end',
      panelClass: 'bookings-filter-offcanvas',
    });
    const instance = ref.componentInstance as BookingsFilterPanelComponent;
    instance.state = this.filterState;
    instance.isAdmin = this.isAdmin;
    instance.enablePastDates = !this.isDriver;
    instance.checkInByOptions = this.checkInByOptions;
    instance.checkOutByOptions = this.checkOutByOptions;

    instance.apply.subscribe((newState: BookingsFilterState) => this.onFiltersApplied(newState));
    instance.reset.subscribe(() => this.onFiltersReset());
  }

  private onFiltersApplied(newState: BookingsFilterState): void {
    const dateChanged = newState.dateFrom !== this.filterState.dateFrom || newState.dateTo !== this.filterState.dateTo;
    this.filterState = newState;
    this.syncFiltersToUrl();
    if (dateChanged) {
      this.loadBookings();
    } else {
      this.applyFilters();
    }
  }

  private onFiltersReset(): void {
    this.filterState = this.createDefaultFilterState();
    this.syncFiltersToUrl();
    this.loadBookings();
  }

  onSortChange(field: BookingSortField): void {
    if (this.filterState.sortField === field) {
      this.filterState = { ...this.filterState, sortDirection: this.filterState.sortDirection === 'asc' ? 'desc' : 'asc' };
    } else {
      this.filterState = { ...this.filterState, sortField: field, sortDirection: 'asc' };
    }
    this.syncFiltersToUrl();
    this.applyFilters();
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

  private checkUserRole(): void {
    this.roleService.getUserRole().subscribe({
      next: (roleInfo: UserRoleInfo) => {
        this.isDriver = roleInfo.isDriver;
        this.isAdmin = roleInfo.isAdmin;
        this.isUser = roleInfo.isUser;
        if (roleInfo.isUser) {
          this.loadCustomerBookingCards();
        }
      },
    });
  }

  private loadCustomerBookingCards(): void {
    this.loadingCustomerBookings = true;
    this.bookingsService.getBookings({ limit: 1000 }).subscribe({
      next: (response) => {
        this.customerBookings = response.data;
        this.loadingCustomerBookings = false;
      },
      error: (err) => {
        console.error('Failed to load booking history:', err);
        this.loadingCustomerBookings = false;
      },
    });
  }

  private isPastDate(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  private isFutureDate(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  }

  get pastBookings(): Booking[] {
    return this.customerBookings
      .filter((b) => b.bookingStatusId === 'bookingStatus_completed' && this.isPastDate(b.dateTo))
      .sort((a, b) => (a.dateTo < b.dateTo ? 1 : -1));
  }

  get upcomingBookings(): Booking[] {
    return this.customerBookings
      .filter((b) => b.bookingStatusId === 'bookingStatus_created' && this.isFutureDate(b.dateFrom))
      .sort((a, b) => (a.dateFrom < b.dateFrom ? -1 : 1));
  }

  formatBookingDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatBookingPrice(price: number | null): string {
    if (price === null) return '-';
    return `€${price.toFixed(2)}`;
  }

  private checkEmailVerification() {
    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.verifiedEmail = user.email_verified;
      }
    });
  }
}
