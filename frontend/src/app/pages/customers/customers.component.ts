import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';

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

interface HistoryBooking {
  id: string;
  plateNo: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  dateFrom: string;
  timeFrom: string | null;
  dateTo: string;
  timeTo: string | null;
  parkingType: string;
  washService: boolean;
  finalPrice: number | null;
  dropOffOption: string | null;
  pickUpOption: string | null;
}

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
  searchTerm = '';

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

  constructor(
    private api: ApiService,
    private modalService: NgbModal
  ) {}

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
        this.allCustomers = response.data;
        this.applySearchFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading customers:', err);
        this.error = err.error?.error || 'Failed to load customers';
        this.loading = false;
      }
    });
  }

  applySearchFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredCustomers = [...this.allCustomers];
    } else {
      this.filteredCustomers = this.allCustomers.filter(customer => {
        const fullName = `${customer.name} ${customer.surname}`.toLowerCase();
        const searchableFields = [
          fullName,
          customer.email,
          customer.name,
          customer.surname,
          customer.phone,
          customer.phoneCode
        ];

        return searchableFields.some(field =>
          field && field.toLowerCase().includes(term)
        );
      });
    }

    this.totalPages = Math.ceil(this.filteredCustomers.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  onSearchChange(): void {
    this.applySearchFilter();
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
      case 'self_drive': return 'Self Drop-Off';
      case 'airport_pickup': return 'Airport Pick-Up';
      default: return option;
    }
  }

  getPickUpLabel(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case 'self_pickup': return 'Self Pick-Up';
      case 'airport_delivery': return 'Delivery to airport';
      default: return option;
    }
  }
}
