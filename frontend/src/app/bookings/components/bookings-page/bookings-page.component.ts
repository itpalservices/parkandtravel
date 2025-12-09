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

  constructor(private bookingsService: BookingsService) {}

  ngOnInit(): void {
    console.log('BookingsPageComponent ngOnInit');
    this.loadBookings();
  }

  loadBookings(): void {
    console.log('loadBookings called');
    this.loading = true;
    this.bookingsService.getBookings().subscribe({
      next: (response) => {
        console.log('Bookings loaded:', response);
        this.bookings = response.data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load bookings:', err);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    console.log('Search term changed:', this.searchTerm);
  }

  onDateFromChange(): void {
    console.log('Date from changed:', this.dateFrom);
  }

  onDateToChange(): void {
    console.log('Date to changed:', this.dateTo);
  }
}
