import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { BookingsService } from '../../../core/services/bookings.service';
import { Booking } from '../../../shared/models/booking.model';
import { BookingsTableComponent } from '../bookings-table/bookings-table.component';
import { BookingsMobileListComponent } from '../bookings-mobile-list/bookings-mobile-list.component';

@Component({
  selector: 'app-bookings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbDatepickerModule,
    BookingsTableComponent,
    BookingsMobileListComponent
  ],
  templateUrl: './bookings-page.component.html',
  styleUrls: ['./bookings-page.component.scss']
})
export class BookingsPageComponent implements OnInit {
  bookings: Booking[] = [];
  loading = false;
  searchTerm = '';
  dateFrom: NgbDateStruct | null = null;
  dateTo: NgbDateStruct | null = null;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(private bookingsService: BookingsService) {}

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {
    this.loading = true;
    this.bookingsService.getBookings().subscribe({
      next: (response) => {
        this.bookings = response.data;
        this.totalPages = Math.ceil(this.bookings.length / this.pageSize) || 1;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load bookings:', err);
        this.loading = false;
      }
    });
  }

  get paginatedBookings(): Booking[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.bookings.slice(start, end);
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
    this.currentPage = 1;
  }

  onDateFromChange(): void {
    this.currentPage = 1;
  }

  onDateToChange(): void {
    this.currentPage = 1;
  }
}
