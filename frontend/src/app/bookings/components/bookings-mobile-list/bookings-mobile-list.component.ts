import { Component, Input, Output, EventEmitter } from '@angular/core';
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
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() pageNumbers: number[] = [];
  @Output() pageChange = new EventEmitter<number>();

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatTime(time: string | null): string {
    return time || '--:--';
  }

  formatCheckIn(booking: Booking): string {
    return booking.timeFrom || '10:00 AM';
  }

  formatArrival(booking: Booking): string {
    const date = this.formatDate(booking.dateTo);
    const time = booking.timeTo || '12:15 PM';
    return `${date} ${time}`;
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
