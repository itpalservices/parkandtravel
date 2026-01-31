import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Booking, DateRangeFilter } from '../../../../shared/models/booking.model';
import { BookingsService } from '../../../../core/services/bookings.service';
import Swal from 'sweetalert2';
import {
  CAR_PICK_UP_OPTIONS,
  CAR_PICK_UP_OPTIONS_LABELS,
} from '../../../../shared/statics/car-pick-up.model';
import {
  CAR_DROP_OFF_OPTIONS,
  CAR_DROP_OFF_OPTIONS_LABELS,
} from '../../../../shared/statics/car-drop-off.model';
import { RouterModule } from '@angular/router';
import { FormAction } from '../../../../shared/enums/form-action.enum';

@Component({
  selector: 'app-bookings-list',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule, CurrencyPipe, RouterModule],
  templateUrl: './bookings-list.component.html',
  styleUrls: ['./bookings-list.component.scss'],
})
export class BookingsListComponent {
  FormAction = FormAction;
  @Input() bookings: Booking[] = [];
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() pageNumbers: number[] = [];
  @Input() isAdmin: boolean = false;
  @Input() isDriver: boolean = false;
  @Input() dateRangeFilter: DateRangeFilter | null = null;
  @Output() pageChange = new EventEmitter<number>();
  @Output() bookingDeleted = new EventEmitter<void>();
  @Output() bookingUpdated = new EventEmitter<void>();

  constructor(private bookingsService: BookingsService) {}

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatCheckIn(booking: Booking): string {
    const date = new Date(booking.dateFrom);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = booking.timeFrom?.slice(0, -3) || '--:--';
    return `${dateStr} ${time}`;
  }

  formatArrival(booking: Booking): string {
    const date = new Date(booking.dateTo);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = booking.timeTo?.slice(0, -3) || '--:--';
    return `${dateStr} ${time}`;
  }

  formatActualCheckOut(booking: Booking): string {
    if (!booking.actualCheckOut) return '';
    const date = new Date(booking.actualCheckOut);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} ${timeStr}`;
  }

  formatVehicle(booking: Booking): string {
    const parts = [booking.carBrand, booking.carModel].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'N/A';
  }

  formatDropOff(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case CAR_DROP_OFF_OPTIONS.selfDropOff:
        return CAR_DROP_OFF_OPTIONS_LABELS.selfDropOff;
      case CAR_DROP_OFF_OPTIONS.airportPickUp:
        return CAR_DROP_OFF_OPTIONS_LABELS.airportPickUp;
      default:
        return '-';
    }
  }

  formatPickUp(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case CAR_PICK_UP_OPTIONS.selfPickUp:
        return CAR_PICK_UP_OPTIONS_LABELS.selfPickUp;
      case CAR_PICK_UP_OPTIONS.deliveryToAirport:
        return CAR_PICK_UP_OPTIONS_LABELS.deliveryToAirport;
      default:
        return '-';
    }
  }

  onDelete(booking: Booking): void {
    Swal.fire({
      title: 'Delete Booking',
      text: `Are you sure you want to delete the booking for ${booking.name} ${booking.surname}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        this.bookingsService.softDelete(booking.id).subscribe({
          next: () => {
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Booking deleted successfully',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
            this.bookingDeleted.emit();
          },
          error: (err) => {
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'error',
              title:
                err.error?.error ||
                err.error?.message ||
                'Failed to delete booking. Please try again.',
              showConfirmButton: false,
              timer: 4000,
              timerProgressBar: true,
            });
          },
        });
      }
    });
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

  isCheckInPast(booking: Booking): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.dateFrom);
    checkInDate.setHours(0, 0, 0, 0);
    return checkInDate < today;
  }

  private extractDatePart(dateString: string): string {
    if (!dateString) return '';
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    if (dateString.length === 10 && dateString.includes('-')) {
      return dateString;
    }
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getStatusBadgeClass(status: string | null): string {
    switch (status) {
      case 'Created':
        return 'bg-warning text-dark';
      case 'Parked':
        return 'bg-info';
      case 'Completed':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  }

  onStatusChange(booking: Booking, newStatusId: string): void {
    const statusLabels: Record<string, string> = {
      bookingStatus_created: 'Created',
      bookingStatus_parked: 'Parked',
      bookingStatus_completed: 'Completed',
    };
    const newStatusLabel = statusLabels[newStatusId] || newStatusId;

    if (newStatusId === 'bookingStatus_parked') {
      this.showParkPlaceModal(booking, newStatusId, newStatusLabel);
    } else if (newStatusId === 'bookingStatus_completed') {
      this.handleCompletedStatus(booking, newStatusId, newStatusLabel);
    } else {
      this.performStatusUpdate(booking, newStatusId, newStatusLabel);
    }
  }

  private handleCompletedStatus(
    booking: Booking,
    newStatusId: string,
    newStatusLabel: string,
  ): void {
    const checkOutDate = new Date(booking.dateTo);
    checkOutDate.setHours(23, 59, 59, 999);
    const now = new Date();

    if (now > checkOutDate) {
      Swal.fire({
        title: 'Late Check-out Detected',
        text: 'The actual check-out is later than the scheduled date. Do you want to apply an extra fee?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Yes, apply extra fee',
        denyButtonText: 'No, skip extra fee',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#006B8F',
        denyButtonColor: '#6c757d',
      }).then((result) => {
        if (result.isConfirmed) {
          this.performStatusUpdate(booking, newStatusId, newStatusLabel, undefined, true);
        } else if (result.isDenied) {
          this.performStatusUpdate(booking, newStatusId, newStatusLabel, undefined, false);
        }
      });
    } else {
      this.performStatusUpdate(booking, newStatusId, newStatusLabel);
    }
  }

  private showParkPlaceModal(booking: Booking, newStatusId: string, newStatusLabel: string): void {
    Swal.fire({
      title: 'Set Parking Place',
      text: 'Please enter the parking place for this vehicle:',
      input: 'text',
      inputPlaceholder: 'e.g., A15, B22',
      showCancelButton: true,
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#006B8F',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Parking place is required';
        }
        return null;
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.performStatusUpdate(booking, newStatusId, newStatusLabel, result.value.trim());
      }
    });
  }

  onRevertToCreated(booking: Booking): void {
    Swal.fire({
      title: 'Revert to Created',
      text: 'By making this change, you will lose the parking place details associated with this status. Do you want to continue?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, revert',
      cancelButtonText: 'No',
      confirmButtonColor: '#006B8F',
      cancelButtonColor: '#6c757d',
    }).then((result) => {
      if (result.isConfirmed) {
        this.performStatusUpdate(booking, 'bookingStatus_created', 'Created');
      }
    });
  }

  private performStatusUpdate(
    booking: Booking,
    newStatusId: string,
    newStatusLabel: string,
    parkPlace?: string,
    applyExtraFee?: boolean,
  ): void {
    this.bookingsService
      .updateBookingStatus(booking.id, newStatusId, parkPlace, applyExtraFee)
      .subscribe({
        next: (response) => {
          if (response.success) {
            booking.bookingStatusId = response.data.bookingStatusId;
            booking.bookingStatus = response.data.bookingStatus;
            Swal.fire({
              icon: 'success',
              title: 'Status Updated',
              text: `Booking status changed to "${newStatusLabel}"`,
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
            this.bookingUpdated.emit();
          }
        },
        error: (error) => {
          console.error('Error updating booking status:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to update booking status. Please try again.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        },
      });
  }
}
