import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Booking } from '../../../shared/models/booking.model';

@Component({
  selector: 'app-bookings-mobile-list',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './bookings-mobile-list.component.html',
  styleUrls: ['./bookings-mobile-list.component.scss']
})
export class BookingsMobileListComponent {
  @Input() bookings: Booking[] = [];

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatCarDetails(booking: Booking): string {
    const parts = [booking.carBrand, booking.carModel, booking.carColor].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'N/A';
  }

  onEdit(booking: Booking): void {
    console.log('Edit booking:', booking.id);
  }

  onDelete(booking: Booking): void {
    console.log('Delete booking:', booking.id);
  }
}
