import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgbDropdownModule, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';
import { Driver, DriverSortField, DriversFilterState } from '../../shared/models/driver.model';
import { PhoneCode } from '../../shared/models/phone-codes.model';
import { buildTelHref } from '../../shared/utils/phone.util';
import {
  buildDriversPredicate,
  countActiveDriverFilters,
  createDefaultDriversFilterState,
  driversFilterStateFromQueryParams,
  driversFilterStateToQueryParams,
  sortDrivers,
} from '../../shared/utils/drivers-filter.util';
import { DriversFilterPanelComponent } from './drivers-filter-panel/drivers-filter-panel.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbDropdownModule],
  templateUrl: './drivers.component.html',
  styleUrl: './drivers.component.scss'
})
export class DriversComponent implements OnInit {
  allDrivers: Driver[] = [];
  filteredDrivers: Driver[] = [];
  phoneCodes: PhoneCode[] = [];
  loading = true;
  error: string | null = null;

  filterState: DriversFilterState = createDefaultDriversFilterState();

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private offcanvasService: NgbOffcanvas,
  ) {}

  ngOnInit(): void {
    const queryParams: Record<string, string | null> = {};
    this.route.snapshot.queryParamMap.keys.forEach((key) => {
      queryParams[key] = this.route.snapshot.queryParamMap.get(key);
    });
    this.filterState = driversFilterStateFromQueryParams(queryParams, createDefaultDriversFilterState());

    this.loadPhoneCodes();
    this.loadDrivers();
  }

  loadPhoneCodes(): void {
    this.api.get<PhoneCode[]>('/phone-codes').subscribe({
      next: (response) => { this.phoneCodes = response; },
      error: (err) => { console.error('Error loading phone codes:', err); }
    });
  }

  loadDrivers(): void {
    this.loading = true;
    this.error = null;
    this.api.get<{ success: boolean; data: Driver[] }>('/user/drivers').subscribe({
      next: (response) => {
        this.allDrivers = response.data;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading drivers:', err);
        this.error = err.error?.error || 'Failed to load drivers';
        this.loading = false;
      }
    });
  }

  /** Re-filters + re-sorts the already-fetched full driver list; no server round-trip. */
  applyFilters(): void {
    const predicate = buildDriversPredicate(this.filterState);
    const filtered = this.allDrivers.filter(predicate);
    this.filteredDrivers = sortDrivers(filtered, this.filterState.sortField, this.filterState.sortDirection);
    this.totalPages = Math.ceil(this.filteredDrivers.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  private syncFiltersToUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: driversFilterStateToQueryParams(this.filterState),
      replaceUrl: true,
    });
  }

  get activeFilterCount(): number {
    return countActiveDriverFilters(this.filterState);
  }

  openFiltersPanel(): void {
    const ref = this.offcanvasService.open(DriversFilterPanelComponent, {
      position: 'end',
      panelClass: 'drivers-filter-offcanvas',
    });
    const instance = ref.componentInstance as DriversFilterPanelComponent;
    instance.state = this.filterState;
    instance.phoneCodes = this.phoneCodes;

    instance.apply.subscribe((newState: DriversFilterState) => {
      this.filterState = newState;
      this.syncFiltersToUrl();
      this.applyFilters();
    });
    instance.reset.subscribe(() => {
      this.filterState = createDefaultDriversFilterState();
      this.syncFiltersToUrl();
      this.applyFilters();
    });
  }

  onSortClick(field: DriverSortField): void {
    if (this.filterState.sortField === field) {
      this.filterState = { ...this.filterState, sortDirection: this.filterState.sortDirection === 'asc' ? 'desc' : 'asc' };
    } else {
      this.filterState = { ...this.filterState, sortField: field, sortDirection: 'asc' };
    }
    this.syncFiltersToUrl();
    this.applyFilters();
  }

  sortIndicator(field: DriverSortField): string {
    if (this.filterState.sortField !== field) return '';
    return this.filterState.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  editDriver(driver: Driver): void {
    this.router.navigate(['/admin/drivers', driver.userId, 'edit']);
  }

  deleteDriver(driver: Driver): void {
    const name = [driver.name, driver.surname].filter(Boolean).join(' ') || driver.email;
    Swal.fire({
      title: 'Delete Driver',
      text: `Are you sure you want to permanently delete ${name}? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.api.delete<{ success: boolean }>(`/user/drivers/${driver.userId}`).subscribe({
        next: () => {
          Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Driver deleted successfully',
            showConfirmButton: false, timer: 3000, timerProgressBar: true,
          });
          this.allDrivers = this.allDrivers.filter(d => d.userId !== driver.userId);
          this.applyFilters();
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to delete driver' });
        }
      });
    });
  }

  resetPassword(driver: Driver): void {
    const name = [driver.name, driver.surname].filter(Boolean).join(' ') || driver.email;
    Swal.fire({
      title: 'Reset Password',
      text: `Send a password reset email to ${name}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Send',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.api.post<{ success: boolean }>(`/user/drivers/${driver.userId}/reset-password`, {}).subscribe({
        next: () => {
          Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Password reset email sent',
            showConfirmButton: false, timer: 3000, timerProgressBar: true,
          });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to send password reset email' });
        }
      });
    });
  }

  toggleBlock(driver: Driver): void {
    const action = driver.blocked ? 'unblock' : 'block';
    const name = [driver.name, driver.surname].filter(Boolean).join(' ') || driver.email;
    Swal.fire({
      title: `${driver.blocked ? 'Unblock' : 'Block'} Driver`,
      text: `Are you sure you want to ${action} ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: driver.blocked ? 'Unblock' : 'Block',
      cancelButtonText: 'Cancel',
      confirmButtonColor: driver.blocked ? '#10b981' : '#f59e0b',
      cancelButtonColor: '#6b7280',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.api.patch<{ success: boolean }>(`/user/drivers/${driver.userId}/block`, { blocked: !driver.blocked }).subscribe({
        next: () => {
          Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: `Driver ${driver.blocked ? 'unblocked' : 'blocked'} successfully`,
            showConfirmButton: false, timer: 3000, timerProgressBar: true,
          });
          this.loadDrivers();
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || `Failed to ${action} driver` });
        }
      });
    });
  }

  get paginatedDrivers(): Driver[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredDrivers.slice(start, end);
  }

  get pageNumbers(): (number | -1)[] {
    const pages: (number | -1)[] = [];
    const maxVisiblePages = 5;
    if (this.totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (this.currentPage > 3) pages.push(-1);
      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(this.totalPages - 1, this.currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (this.currentPage < this.totalPages - 2) pages.push(-1);
      pages.push(this.totalPages);
    }
    return pages;
  }

  onPrevious(): void {
    if (this.currentPage > 1) { this.currentPage--; }
  }

  onNext(): void {
    if (this.currentPage < this.totalPages) { this.currentPage++; }
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) { this.currentPage = page; }
  }

  getCountryFlag(phoneCode: string): string {
    if (!phoneCode) return '';
    const code = this.phoneCodes.find(pc => pc.phoneCode === phoneCode);
    return code ? `https://flagcdn.com/24x18/${code.isoCode.toLowerCase()}.png` : '';
  }

  getIsoCode(phoneCode: string): string {
    if (!phoneCode) return '';
    const code = this.phoneCodes.find(pc => pc.phoneCode === phoneCode);
    return code?.isoCode || '';
  }

  getTelHref(phoneCode: string | null | undefined, phone: string | null | undefined): string | null {
    return buildTelHref(phoneCode, phone);
  }
}
