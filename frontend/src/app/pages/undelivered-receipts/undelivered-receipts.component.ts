import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgbCalendar, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { BookingsService } from '../../core/services/bookings.service';
import { Booking, BookingSortField, BookingsFilterState } from '../../shared/models/booking.model';
import { BookingsFilterPanelComponent } from '../bookings/components/bookings-filter-panel/bookings-filter-panel.component';
import { PRIMARY_COLOR } from '../../shared/constants/theme.constants';
import Swal from 'sweetalert2';
import {
  buildBookingsPredicate,
  computePageNumbers,
  countActiveFilters,
  createDefaultBookingsFilterState,
  filterStateFromQueryParams,
  filterStateToQueryParams,
  sortBookings,
} from '../../shared/utils/bookings-filter.util';

/**
 * super_admin only: completed bookings whose receipt was never delivered to the customer
 * (bookings.emailSent = false — neither emailed as an attachment nor printed).
 * Same filters and date-range semantics as the bookings listing, with a minimal table.
 */
@Component({
  selector: 'app-undelivered-receipts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './undelivered-receipts.component.html',
  styleUrls: [
    '../bookings/components/bookings-page/bookings-page.component.scss',
    '../bookings/components/bookings-list/bookings-list.component.scss',
    './undelivered-receipts.component.scss',
  ],
})
export class UndeliveredReceiptsComponent implements OnInit {
  /** Sortable columns of this table — also limits the filter panel's mobile "Sort by". */
  readonly sortableFields: BookingSortField[] = ['name', 'plateNo', 'checkIn', 'checkOut', 'checkOutBy', 'finalPrice'];

  allBookings: Booking[] = [];
  filteredBookings: Booking[] = [];
  loading = false;
  errorMessage = '';

  filterState!: BookingsFilterState;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  /** Bookings ticked for "Hide". Kept across pages; pruned to what the filters still show. */
  selectedIds = new Set<string>();
  hiding = false;

  constructor(
    private bookingsService: BookingsService,
    private calendar: NgbCalendar,
    private router: Router,
    private route: ActivatedRoute,
    private offcanvasService: NgbOffcanvas,
  ) {}

  ngOnInit(): void {
    const queryParams: Record<string, string | null> = {};
    this.route.snapshot.queryParamMap.keys.forEach((key) => {
      queryParams[key] = this.route.snapshot.queryParamMap.get(key);
    });
    this.filterState = filterStateFromQueryParams(queryParams, this.createDefaultFilterState());
    this.loadBookings();
  }

  private createDefaultFilterState(): BookingsFilterState {
    const today = this.calendar.getToday();
    const todayStr = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    return createDefaultBookingsFilterState(todayStr, todayStr, 'today');
  }

  loadBookings(): void {
    this.loading = true;
    this.errorMessage = '';

    this.bookingsService.getUndeliveredReceiptBookings({
      dateFrom: this.filterState.dateFrom ?? undefined,
      dateTo: this.filterState.dateTo ?? undefined,
    }).subscribe({
      next: (response) => {
        this.allBookings = response.data;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load undelivered receipts:', err);
        this.errorMessage = err.message || 'Failed to load bookings. Please try again.';
        this.loading = false;
      },
    });
  }

  /** Re-filters + re-sorts the already-fetched date-range set; no server round-trip. */
  applyFilters(): void {
    const predicate = buildBookingsPredicate(this.filterState);
    this.filteredBookings = sortBookings(
      this.allBookings.filter(predicate),
      this.filterState.sortField,
      this.filterState.sortDirection,
    );
    this.totalPages = Math.ceil(this.filteredBookings.length / this.pageSize) || 1;
    this.currentPage = 1;
    const visibleIds = new Set(this.filteredBookings.map((b) => b.id));
    this.selectedIds = new Set([...this.selectedIds].filter((id) => visibleIds.has(id)));
  }

  isSelected(booking: Booking): boolean {
    return this.selectedIds.has(booking.id);
  }

  toggleSelected(booking: Booking): void {
    if (this.selectedIds.has(booking.id)) {
      this.selectedIds.delete(booking.id);
    } else {
      this.selectedIds.add(booking.id);
    }
  }

  get allOnPageSelected(): boolean {
    return this.paginatedBookings.length > 0 && this.paginatedBookings.every((b) => this.selectedIds.has(b.id));
  }

  get someOnPageSelected(): boolean {
    return !this.allOnPageSelected && this.paginatedBookings.some((b) => this.selectedIds.has(b.id));
  }

  toggleAllOnPage(): void {
    const selectAll = !this.allOnPageSelected;
    this.paginatedBookings.forEach((b) => selectAll ? this.selectedIds.add(b.id) : this.selectedIds.delete(b.id));
  }

  async hideSelected(): Promise<void> {
    const count = this.selectedIds.size;
    if (count === 0 || this.hiding) return;

    const confirm = await Swal.fire({
      icon: 'question',
      title: `Hide ${count} booking${count === 1 ? '' : 's'}?`,
      text: 'They will no longer be visible.',
      showCancelButton: true,
      confirmButtonText: 'Hide',
      cancelButtonText: 'Cancel',
      confirmButtonColor: PRIMARY_COLOR,
    });
    if (!confirm.isConfirmed) return;

    this.hiding = true;
    this.bookingsService.dismissUndeliveredReceiptBookings([...this.selectedIds]).subscribe({
      next: (res) => {
        this.hiding = false;
        this.selectedIds.clear();
        const dismissed = res.data?.dismissed ?? 0;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `${dismissed} booking${dismissed === 1 ? '' : 's'} hidden`,
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
        this.loadBookings();
      },
      error: (err) => {
        this.hiding = false;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: err.error?.error || 'Failed to hide bookings',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  private syncFiltersToUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filterStateToQueryParams(this.filterState),
      replaceUrl: true,
    });
  }

  openFiltersPanel(): void {
    const ref = this.offcanvasService.open(BookingsFilterPanelComponent, {
      position: 'end',
      panelClass: 'bookings-filter-offcanvas',
    });
    const instance = ref.componentInstance as BookingsFilterPanelComponent;
    instance.state = this.filterState;
    // Source / Check In By / Check Out By filters are shown, like for admins.
    instance.isAdmin = true;
    instance.enablePastDates = true;
    instance.showStatusFilter = false;
    instance.allowedSortFields = this.sortableFields;
    instance.checkInByOptions = this.uniqueSorted(this.allBookings.map((b) => b.checkInBy));
    instance.checkOutByOptions = this.uniqueSorted(this.allBookings.map((b) => b.checkOutBy));

    instance.apply.subscribe((newState: BookingsFilterState) => {
      const dateChanged = newState.dateFrom !== this.filterState.dateFrom || newState.dateTo !== this.filterState.dateTo;
      this.filterState = newState;
      this.syncFiltersToUrl();
      if (dateChanged) {
        this.loadBookings();
      } else {
        this.applyFilters();
      }
    });
    instance.reset.subscribe(() => {
      this.filterState = this.createDefaultFilterState();
      this.syncFiltersToUrl();
      this.loadBookings();
    });
  }

  onSortClick(field: BookingSortField): void {
    if (this.filterState.sortField === field) {
      this.filterState = { ...this.filterState, sortDirection: this.filterState.sortDirection === 'asc' ? 'desc' : 'asc' };
    } else {
      this.filterState = { ...this.filterState, sortField: field, sortDirection: 'asc' };
    }
    this.syncFiltersToUrl();
    this.applyFilters();
  }

  sortIndicator(field: BookingSortField): string {
    if (this.filterState.sortField !== field) return '';
    return this.filterState.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  get activeFilterCount(): number {
    return countActiveFilters(this.filterState);
  }

  get dateRangeLabel(): string {
    if (!this.filterState.dateFrom) return 'All dates';
    const from = this.formatApiDate(this.filterState.dateFrom);
    const to = this.filterState.dateTo ? this.formatApiDate(this.filterState.dateTo) : from;
    return from === to ? from : `${from} - ${to}`;
  }

  get paginatedBookings(): Booking[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredBookings.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return computePageNumbers(this.currentPage, this.totalPages);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  formatCheckIn(booking: Booking): string {
    return `${this.formatDate(booking.dateFrom)} ${booking.timeFrom?.slice(0, 5) || '--:--'}`;
  }

  /** The actual check-out once recorded (always, for completed bookings), else the scheduled one. */
  formatCheckOut(booking: Booking): string {
    if (booking.actualCheckOut) {
      const d = new Date(booking.actualCheckOut);
      return `${this.formatDate(booking.actualCheckOut)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (!booking.dateTo) return '-';
    return `${this.formatDate(booking.dateTo)} ${booking.timeTo?.slice(0, 5) || '--:--'}`;
  }

  formatPrice(price: number | null): string {
    return price === null ? '-' : `€${price.toFixed(2)}`;
  }

  private formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private formatApiDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  private uniqueSorted(values: (string | null)[]): string[] {
    return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  }
}
