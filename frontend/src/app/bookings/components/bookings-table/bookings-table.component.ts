import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Booking } from '../../../shared/models/booking.model';

@Component({
  selector: 'app-bookings-table',
  standalone: true,
  imports: [CommonModule, NgxDatatableModule, NgbDropdownModule],
  templateUrl: './bookings-table.component.html',
  styleUrls: ['./bookings-table.component.scss']
})
export class BookingsTableComponent {
  @Input() bookings: Booking[] = [];

  formatDateRange(booking: Booking): string {
    const dateFrom = new Date(booking.dateFrom).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const dateTo = new Date(booking.dateTo).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeFrom = booking.timeFrom || '--:--';
    const timeTo = booking.timeTo || '--:--';
    return `${dateFrom} ${timeFrom} → ${dateTo} ${timeTo}`;
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
