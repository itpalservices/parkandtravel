import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Booking } from '../../../../shared/models/booking.model';
import { BookingsService } from '../../../../core/services/bookings.service';
import Swal from 'sweetalert2';
import { RoleService, UserRoleInfo } from '../../../../core/services/role.service';
import { CAR_PICK_UP_OPTIONS, CAR_PICK_UP_OPTIONS_LABELS } from '../../../../shared/statics/car-pick-up.model';
import { CAR_DROP_OFF_OPTIONS, CAR_DROP_OFF_OPTIONS_LABELS } from '../../../../shared/statics/car-drop-off.model';

@Component({
  selector: 'app-bookings-list',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule, CurrencyPipe],
  templateUrl: './bookings-list.component.html',
  styleUrls: ['./bookings-list.component.scss']
})
export class BookingsListComponent implements OnInit {  
  @Input() bookings: Booking[] = [];
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() pageNumbers: number[] = [];
  @Output() pageChange = new EventEmitter<number>();
  @Output() bookingDeleted = new EventEmitter<void>();

  isAdmin: boolean = false;

  constructor(private bookingsService: BookingsService, private roleService: RoleService) {}

  ngOnInit() {    
    this.checkUserRole();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatCheckIn(booking: Booking): string {
    const date = new Date(booking.dateFrom);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = booking.timeFrom?.slice(0, -3) || '--:--';
    return `${dateStr} ${time}`;
  }

  formatArrival(booking: Booking): string {
    const date = new Date(booking.dateTo);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = booking.timeTo?.slice(0, -3) || '--:--';
    return `${dateStr} ${time}`;
  }

  formatVehicle(booking: Booking): string {
    const parts = [booking.carBrand, booking.carModel].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'N/A';
  }

  formatDropOff(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case CAR_DROP_OFF_OPTIONS.selfDropOff: return CAR_DROP_OFF_OPTIONS_LABELS.selfDropOff;
      case CAR_DROP_OFF_OPTIONS.airportPickUp: return CAR_DROP_OFF_OPTIONS_LABELS.airportPickUp;
      default: return '-';
    }
  }

  formatPickUp(option: string | null): string {
    if (!option) return '-';
    switch (option) {
      case CAR_PICK_UP_OPTIONS.selfPickUp: return CAR_PICK_UP_OPTIONS_LABELS.selfPickUp;
      case CAR_PICK_UP_OPTIONS.deliveryToAirport: return CAR_PICK_UP_OPTIONS_LABELS.deliveryToAirport;
      default: return '-';
    }
  }

  onEdit(booking: Booking): void {
    console.log('Edit booking:', booking.id);
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
      cancelButtonText: 'Cancel'
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
              timerProgressBar: true
            });
            this.bookingDeleted.emit();
          },
          error: (err) => {
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Failed to delete booking. Please try again.',
              icon: 'error',
              confirmButtonColor: '#006B8F'
            });
          }
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

  private checkUserRole(): void {
      this.roleService.getUserRole().subscribe({
        next: (roleInfo: UserRoleInfo) => {
          this.isAdmin = roleInfo.isAdmin;
        },
      });
    }
}
