import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';
import { Driver } from '../../shared/models/driver.model';
import { PhoneCode } from '../../shared/models/phone-codes.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbDropdownModule],
  templateUrl: './drivers.component.html',
  styleUrl: './drivers.component.scss'
})
export class DriversComponent implements OnInit {
  drivers: Driver[] = [];
  phoneCodes: PhoneCode[] = [];
  loading = true;
  error: string | null = null;

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
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
    const page = this.currentPage - 1;
    this.api.get<{ success: boolean; data: Driver[]; total: number }>(`/user/drivers?page=${page}`).subscribe({
      next: (response) => {
        this.drivers = response.data;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading drivers:', err);
        this.error = err.error?.error || 'Failed to load drivers';
        this.loading = false;
      }
    });
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
          this.drivers = this.drivers.filter(d => d.userId !== driver.userId);
          this.totalItems = Math.max(0, this.totalItems - 1);
          if (this.drivers.length === 0 && this.currentPage > 1) {
            this.currentPage--;
            this.loadDrivers();
          }
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to delete driver' });
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

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
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
    if (this.currentPage > 1) { this.currentPage--; this.loadDrivers(); }
  }

  onNext(): void {
    if (this.currentPage < this.totalPages) { this.currentPage++; this.loadDrivers(); }
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) { this.currentPage = page; this.loadDrivers(); }
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
}
