import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbModalModule, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';
import { CAR_DROP_OFF_OPTIONS, CAR_DROP_OFF_OPTIONS_LABELS } from '../../shared/statics/car-drop-off.model';
import { CAR_PICK_UP_OPTIONS, CAR_PICK_UP_OPTIONS_LABELS } from '../../shared/statics/car-pick-up.model';
import { PhoneCode } from '../../shared/models/phone-codes.model';
import { Customer, CustomerSortField, CustomersFilterState } from '../../shared/models/customers.model';
import { HistoryBooking } from '../../shared/models/booking.model';
import { buildTelHref } from '../../shared/utils/phone.util';
import {
  buildCustomersPredicate,
  countActiveCustomerFilters,
  createDefaultCustomersFilterState,
  customersFilterStateFromQueryParams,
  customersFilterStateToQueryParams,
  sortCustomers,
} from '../../shared/utils/customers-filter.util';
import { CustomersFilterPanelComponent } from './customers-filter-panel/customers-filter-panel.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModalModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  allCustomers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  phoneCodes: PhoneCode[] = [];
  loading = true;
  error: string | null = null;

  filterState: CustomersFilterState = createDefaultCustomersFilterState();

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  selectedCustomer: Customer | null = null;
  historyBookings: HistoryBooking[] = [];
  filteredHistoryBookings: HistoryBooking[] = [];
  historyLoading = false;
  historyError: string | null = null;
  historySearchTerm = '';
  historyCurrentPage = 1;
  historyPageSize = 5;
  historyTotalPages = 1;

  settingsCustomer: Customer | null = null;
  discountPercentage: number | null = null;
  discountInput: number | string = '';
  exemptMandatoryPayment = false;
  settingsLoading = false;
  settingsSaving = false;
  settingsError: string | null = null;
  settingsSuccess = false;

  constructor(
    private api: ApiService,
    private modalService: NgbModal,
    private offcanvasService: NgbOffcanvas,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const queryParams: Record<string, string | null> = {};
    this.route.snapshot.queryParamMap.keys.forEach((key) => {
      queryParams[key] = this.route.snapshot.queryParamMap.get(key);
    });
    this.filterState = customersFilterStateFromQueryParams(queryParams, createDefaultCustomersFilterState());

    this.loadPhoneCodes();
    this.loadCustomers();
  }

  loadPhoneCodes(): void {
    this.api.get<PhoneCode[]>('/phone-codes').subscribe({
      next: (response) => {
        this.phoneCodes = response;
      },
      error: (err) => {
        console.error('Error loading phone codes:', err);
      }
    });
  }

  loadCustomers(): void {
    this.loading = true;
    this.error = null;

    this.api.get<{ success: boolean; data: Customer[] }>('/user/customers').subscribe({
      next: (response) => {
        this.allCustomers = response.data;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading customers:', err);
        this.error = err.error?.error || 'Failed to load customers';
        this.loading = false;
      }
    });
  }

  /** Re-filters + re-sorts the already-fetched full customer list; no server round-trip. */
  applyFilters(): void {
    const predicate = buildCustomersPredicate(this.filterState);
    const filtered = this.allCustomers.filter(predicate);
    this.filteredCustomers = sortCustomers(filtered, this.filterState.sortField, this.filterState.sortDirection);
    this.totalPages = Math.ceil(this.filteredCustomers.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  private syncFiltersToUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: customersFilterStateToQueryParams(this.filterState),
      replaceUrl: true,
    });
  }

  get activeFilterCount(): number {
    return countActiveCustomerFilters(this.filterState);
  }

  openFiltersPanel(): void {
    const ref = this.offcanvasService.open(CustomersFilterPanelComponent, {
      position: 'end',
      panelClass: 'customers-filter-offcanvas',
    });
    const instance = ref.componentInstance as CustomersFilterPanelComponent;
    instance.state = this.filterState;
    instance.phoneCodes = this.phoneCodes;

    instance.apply.subscribe((newState: CustomersFilterState) => {
      this.filterState = newState;
      this.syncFiltersToUrl();
      this.applyFilters();
    });
    instance.reset.subscribe(() => {
      this.filterState = createDefaultCustomersFilterState();
      this.syncFiltersToUrl();
      this.applyFilters();
    });
  }

  onSortClick(field: CustomerSortField): void {
    if (this.filterState.sortField === field) {
      this.filterState = { ...this.filterState, sortDirection: this.filterState.sortDirection === 'asc' ? 'desc' : 'asc' };
    } else {
      this.filterState = { ...this.filterState, sortField: field, sortDirection: 'asc' };
    }
    this.syncFiltersToUrl();
    this.applyFilters();
  }

  sortIndicator(field: CustomerSortField): string {
    if (this.filterState.sortField !== field) return '';
    return this.filterState.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  get paginatedCustomers(): Customer[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredCustomers.slice(start, end);
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

  getCountryFlag(phoneCode: string): string {
    if (!phoneCode) return '';
    const code = this.phoneCodes.find(pc => pc.phoneCode === phoneCode);
    if (code) {
      return `https://flagcdn.com/24x18/${code.isoCode.toLowerCase()}.png`;
    }
    return '';
  }

  getIsoCode(phoneCode: string): string {
    if (!phoneCode) return '';
    const code = this.phoneCodes.find(pc => pc.phoneCode === phoneCode);
    return code?.isoCode || '';
  }

  getTelHref(phoneCode: string | null | undefined, phone: string | null | undefined): string | null {
    return buildTelHref(phoneCode, phone);
  }

  onPrevious(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  onNext(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  openSettingsModal(customer: Customer, content: any): void {
    this.settingsCustomer = customer;
    this.discountPercentage = null;
    this.discountInput = '';
    this.exemptMandatoryPayment = false;
    this.settingsError = null;
    this.settingsSuccess = false;
    this.settingsLoading = true;

    this.modalService.open(content, { size: 'sm', centered: true });

    this.api.get<{ success: boolean; data: { discountPercentage: number | null; exemptMandatoryPayment: boolean } }>(`/user/${customer.userId}/settings`).subscribe({
      next: (response) => {
        this.discountPercentage = response.data.discountPercentage;
        this.discountInput = this.discountPercentage !== null ? this.discountPercentage : '';
        this.exemptMandatoryPayment = response.data.exemptMandatoryPayment ?? false;
        this.settingsLoading = false;
      },
      error: (err) => {
        this.settingsError = err.error?.error || 'Failed to load settings';
        this.settingsLoading = false;
      }
    });
  }

  saveSettings(modal: any): void {
    this.settingsError = null;
    this.settingsSuccess = false;

    const raw = this.discountInput !== null && this.discountInput !== undefined ? String(this.discountInput).trim() : '';
    let valueToSave: number | null = null;

    if (raw !== '' && raw !== 'null') {
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        this.settingsError = 'Please enter an integer between 0 and 100';
        return;
      }
      valueToSave = parsed;
    }

    if (!this.settingsCustomer) return;
    this.settingsSaving = true;

    this.api.patch<{ success: boolean }>(`/user/${this.settingsCustomer.userId}/settings`, {
      discountPercentage: valueToSave,
      exemptMandatoryPayment: this.exemptMandatoryPayment,
    }).subscribe({
      next: () => {
        this.settingsSaving = false;
        this.settingsSuccess = true;
        setTimeout(() => modal.close(), 1200);
      },
      error: (err) => {
        this.settingsSaving = false;
        this.settingsError = err.error?.error || 'Failed to save settings';
      }
    });
  }

  openHistoryModal(customer: Customer, content: any): void {
    this.selectedCustomer = customer;
    this.historyBookings = [];
    this.filteredHistoryBookings = [];
    this.historySearchTerm = '';
    this.historyCurrentPage = 1;
    this.historyError = null;
    this.historyLoading = true;

    this.modalService.open(content, { size: 'xl', centered: true });
    this.loadCustomerBookings(customer.userId);
  }

  loadCustomerBookings(userId: string): void {
    this.api.get<{ success: boolean; data: HistoryBooking[] }>(`/user/${userId}/bookings`).subscribe({
      next: (response) => {
        this.historyBookings = response.data;
        this.applyHistorySearchFilter();
        this.historyLoading = false;
      },
      error: (err) => {
        console.error('Error loading customer bookings:', err);
        this.historyError = err.error?.error || 'Failed to load booking history';
        this.historyLoading = false;
      }
    });
  }

  applyHistorySearchFilter(): void {
    const term = this.historySearchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredHistoryBookings = [...this.historyBookings];
    } else {
      this.filteredHistoryBookings = this.historyBookings.filter(booking => {
        const vehicle = `${booking.carBrand} ${booking.carModel}`.toLowerCase();
        const searchableFields = [
          booking.plateNo,
          vehicle,
          booking.carColor,
          booking.parkingType,
          booking.dateFrom,
          booking.dateTo
        ];

        return searchableFields.some(field =>
          field && field.toLowerCase().includes(term)
        );
      });
    }

    this.historyTotalPages = Math.ceil(this.filteredHistoryBookings.length / this.historyPageSize) || 1;
    this.historyCurrentPage = 1;
  }

  onHistorySearchChange(): void {
    this.applyHistorySearchFilter();
  }

  get paginatedHistoryBookings(): HistoryBooking[] {
    const start = (this.historyCurrentPage - 1) * this.historyPageSize;
    const end = start + this.historyPageSize;
    return this.filteredHistoryBookings.slice(start, end);
  }

  get historyPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;

    if (this.historyTotalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= this.historyTotalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (this.historyCurrentPage > 3) {
        pages.push(-1);
      }

      const start = Math.max(2, this.historyCurrentPage - 1);
      const end = Math.min(this.historyTotalPages - 1, this.historyCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (this.historyCurrentPage < this.historyTotalPages - 2) {
        pages.push(-1);
      }

      pages.push(this.historyTotalPages);
    }

    return pages;
  }

  onHistoryPrevious(): void {
    if (this.historyCurrentPage > 1) {
      this.historyCurrentPage--;
    }
  }

  onHistoryNext(): void {
    if (this.historyCurrentPage < this.historyTotalPages) {
      this.historyCurrentPage++;
    }
  }

  onHistoryPageChange(page: number): void {
    if (page >= 1 && page <= this.historyTotalPages) {
      this.historyCurrentPage = page;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(timeStr: string | null): string {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5);
  }

  formatPrice(price: number | null): string {
    if (price === null) return '-';
    return `€${price.toFixed(2)}`;
  }

  getDropOffLabel(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case CAR_DROP_OFF_OPTIONS.selfDropOff: return CAR_DROP_OFF_OPTIONS_LABELS.selfDropOff;
      case CAR_DROP_OFF_OPTIONS.airportPickUp: return CAR_DROP_OFF_OPTIONS_LABELS.airportPickUp;
      default: return option;
    }
  }

  getPickUpLabel(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case CAR_PICK_UP_OPTIONS.selfPickUp: return CAR_PICK_UP_OPTIONS_LABELS.selfPickUp;
      case CAR_PICK_UP_OPTIONS.deliveryToAirport: return CAR_PICK_UP_OPTIONS_LABELS.deliveryToAirport;
      default: return option;
    }
  }

  getStatusBadgeClass(status: string | null): string {
    switch (status?.toLowerCase()) {
      case 'created':
        return 'bg-warning text-dark';
      case 'parked':
        return 'bg-info';
      case 'completed':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  }

  formatActualCheckOut(booking: HistoryBooking): string {
    if (!booking.actualCheckOut) return '-';
    const date = new Date(booking.actualCheckOut);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
           date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  getTotalPrice(booking: HistoryBooking): number {
    const base = booking.finalPrice || 0;
    const extra = booking.extraFee || 0;
    return base + extra;
  }
}
