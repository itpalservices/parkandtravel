import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { BookingsService } from '../../../../core/services/bookings.service';
import { Booking } from '../../../../shared/models/booking.model';
import { DateRangePickerComponent, DateRange } from '../../../../shared/components/date-range-picker/date-range-picker.component';
import { BookingsListComponent } from '../bookings-list/bookings-list.component';

@Component({
  selector: 'app-bookings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbDatepickerModule,
    DateRangePickerComponent,
    BookingsListComponent
  ],
  templateUrl: './bookings-page.component.html',
  styleUrls: ['./bookings-page.component.scss']
})
export class BookingsPageComponent implements OnInit {
  allBookings: Booking[] = [];
  filteredBookings: Booking[] = [];
  loading = false;
  errorMessage = '';
  searchTerm = '';

  dateFilter: DateRange = { from: null, to: null, preset: null };

  currentPage = 1;
  pageSize = 10000;
  totalPages = 1;

  constructor(
    private bookingsService: BookingsService,
    private calendar: NgbCalendar
  ) {}

  ngOnInit(): void {
    this.initDefaultDateRange();
    this.loadBookings();
  }

  private initDefaultDateRange(): void {
    const today = this.calendar.getToday();
    const fromDate = new Date(today.year, today.month - 1, today.day);
    const toDate = new Date(today.year, today.month - 1, today.day);
    
    this.dateFilter = {
      from: fromDate,
      to: toDate,
      preset: 'today'
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
    
    const params: { dateFrom?: string; dateTo?: string } = {};
    
    if (this.dateFilter.from) {
      params.dateFrom = this.formatDateForApi(this.dateFilter.from);
    }
    if (this.dateFilter.to) {
      params.dateTo = this.formatDateForApi(this.dateFilter.to);
    }

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
      }
    });
  }

  private applySearchFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    
    if (!term) {
      this.filteredBookings = [...this.allBookings];
    } else {
      this.filteredBookings = this.allBookings.filter(booking => {
        const fullName = `${booking.name} ${booking.surname}`.toLowerCase();
        const searchableFields = [
          fullName,
          booking.email,
          booking.phone,
          booking.plateNo,
          booking.returnFlight,
          booking.parkingType,
          booking.dateFrom,
          booking.dateTo,
          booking.carBrand,
          booking.carModel,
          booking.carColor
        ];
        
        return searchableFields.some(field => 
          field && field.toLowerCase().includes(term)
        );
      });
    }
    
    this.totalPages = Math.ceil(this.filteredBookings.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFilter = range;
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
}
