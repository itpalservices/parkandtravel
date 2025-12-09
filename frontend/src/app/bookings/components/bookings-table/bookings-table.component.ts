import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Booking } from '../../../shared/models/booking.model';

@Component({
  selector: 'app-bookings-table',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './bookings-table.component.html',
  styleUrls: ['./bookings-table.component.scss']
})
export class BookingsTableComponent {
  @Input() bookings: Booking[] = [];
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() pageNumbers: number[] = [];
  @Output() pageChange = new EventEmitter<number>();

  formatCheckIn(booking: Booking): string {
    const date = new Date(booking.dateFrom);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = booking.timeFrom || '--:--';
    return `${dateStr} ${time}`;
  }

  formatArrival(booking: Booking): string {
    const date = new Date(booking.dateTo);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = booking.timeTo || '--:--';
    return `${dateStr} ${time}`;
  }

  formatVehicle(booking: Booking): string {
    const parts = [booking.carBrand, booking.carModel].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'N/A';
  }

  formatParkingType(booking: Booking): string {
    const type = booking.parkingType?.name || 'Standard';
    if (type.toLowerCase().includes('covered') || type.toLowerCase().includes('cov')) {
      return 'cov.';
    } else if (type.toLowerCase().includes('uncovered') || type.toLowerCase().includes('unc')) {
      return 'unc.';
    }
    return type;
  }

  onEdit(booking: Booking): void {
    console.log('Edit booking:', booking.id);
  }

  onDelete(booking: Booking): void {
    console.log('Delete booking:', booking.id);
  }

  onPrevious(): void {
    if (this.currentPage > 1) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  onNext(): void {
    if (this.currentPage < this.totalPages) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }

  onPageClick(page: number): void {
    if (page > 0 && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }
}
