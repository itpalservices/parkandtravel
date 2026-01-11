import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

interface Customer {
  userId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
}

interface PhoneCode {
  id: string;
  isoCode: string;
  phoneCode: string;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  customers: Customer[] = [];
  phoneCodes: PhoneCode[] = [];
  loading = true;
  error: string | null = null;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  pageNumbers: number[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
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
        this.customers = response.data;
        this.totalPages = Math.ceil(this.customers.length / this.pageSize);
        this.updatePageNumbers();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading customers:', err);
        this.error = err.error?.error || 'Failed to load customers';
        this.loading = false;
      }
    });
  }

  get paginatedCustomers(): Customer[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.customers.slice(start, end);
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

  updatePageNumbers(): void {
    const pages: number[] = [];
    const maxVisible = 5;

    if (this.totalPages <= maxVisible) {
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

    this.pageNumbers = pages;
  }

  onPrevious(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePageNumbers();
    }
  }

  onNext(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePageNumbers();
    }
  }

  onPageClick(page: number): void {
    if (page > 0 && page !== this.currentPage) {
      this.currentPage = page;
      this.updatePageNumbers();
    }
  }
}
