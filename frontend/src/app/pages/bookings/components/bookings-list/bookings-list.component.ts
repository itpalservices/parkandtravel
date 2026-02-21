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
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';

@Component({
  selector: 'app-bookings-list',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule, CurrencyPipe, RouterModule, ImageCarouselComponent],
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

  showCarousel = false;
  carouselImages: string[] = [];
  carouselStartIndex = 0;

  constructor(private bookingsService: BookingsService) {}

  canHaveImages(booking: Booking): boolean {
    return booking.bookingStatusId === 'bookingStatus_parked' || booking.bookingStatusId === 'bookingStatus_completed';
  }

  openCarouselForBooking(bookingId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.bookingsService.getBookingImages(bookingId).subscribe({
      next: (response) => {
        if (response.success && response.data.urls.length > 0) {
          this.carouselImages = response.data.urls;
          this.carouselStartIndex = 0;
          this.showCarousel = true;
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'No photos uploaded for this booking',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Failed to load photos',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      },
    });
  }

  closeCarousel(): void {
    this.showCarousel = false;
  }

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
    let result = parts.length > 0 ? parts.join(' ') : 'N/A';
    if (booking.bookingStatusId === 'bookingStatus_parked' && booking.mileageKm != null) {
      result += ` (${booking.mileageKm} km)`;
    }
    return result;
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
      this.showParkPlaceAndImagesModal(booking, newStatusId, newStatusLabel);
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

  private showParkPlaceAndImagesModal(
    booking: Booking,
    newStatusId: string,
    newStatusLabel: string,
  ): void {
    const modalSelectedFiles: File[] = [];

    Swal.fire({
      title: 'Parked Details',
      html: `
        <div style="text-align: left;">
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Parking Place <span style="color: #dc3545;">*</span></label>
              <input id="swal-park-place" class="swal2-input" placeholder="e.g., A15, B22" style="margin: 0; width: 100%; box-sizing: border-box;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Km</label>
              <input id="swal-mileage" class="swal2-input" type="number" min="0" placeholder="Mileage" style="margin: 0; width: 100%; box-sizing: border-box;" />
            </div>
          </div>
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Plate No.</label>
              <input id="swal-plate-no" class="swal2-input" placeholder="Plate number" value="${booking.plateNo || ''}" style="margin: 0; width: 100%; box-sizing: border-box;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Car Model</label>
              <input id="swal-car-model" class="swal2-input" placeholder="Car model" value="${booking.carModel || ''}" style="margin: 0; width: 100%; box-sizing: border-box;" />
            </div>
          </div>
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Adults <span style="color: #dc3545;">*</span></label>
              <input id="swal-adults" class="swal2-input" type="number" min="1" max="20" value="${booking.adults || 1}" style="margin: 0; width: 100%; box-sizing: border-box;" />
            </div>
            <div style="flex: 1; display: flex; align-items: flex-end; padding-bottom: 4px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; color: #374151; font-size: 14px; user-select: none;">
                <input id="swal-keep-keys" type="checkbox" style="width: 18px; height: 18px; cursor: pointer;" />
                Keep Keys
              </label>
            </div>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Comments</label>
            <textarea id="swal-comments" class="swal2-textarea" placeholder="Any notes..." style="resize: none; margin: 0; width: 100%; box-sizing: border-box; min-height: 60px; resize: vertical;"></textarea>
          </div>
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Vehicle Photos</label>
          <div id="swal-image-upload-area" style="border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px 16px; text-align: center; cursor: pointer; transition: all 0.2s ease; background: #f9fafb;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 8px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">Click or drag & drop to upload</p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">JPG, PNG or WEBP (max 10MB each)</p>
          </div>
          <input type="file" id="swal-image-input" multiple accept="image/jpeg,image/png,image/webp" style="display: none;" />
          <div id="swal-image-preview" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;"></div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#006B8F',
      width: 520,
      didOpen: () => {
        const uploadArea = document.getElementById('swal-image-upload-area')!;
        const fileInput = document.getElementById('swal-image-input') as HTMLInputElement;
        const previewContainer = document.getElementById('swal-image-preview')!;

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.style.borderColor = '#006B8F';
          uploadArea.style.background = '#f0f9ff';
        });

        uploadArea.addEventListener('dragleave', () => {
          uploadArea.style.borderColor = '#d1d5db';
          uploadArea.style.background = '#f9fafb';
        });

        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.style.borderColor = '#d1d5db';
          uploadArea.style.background = '#f9fafb';
          if (e.dataTransfer?.files) {
            this.handleImageFiles(
              Array.from(e.dataTransfer.files),
              modalSelectedFiles,
              previewContainer,
            );
          }
        });

        fileInput.addEventListener('change', () => {
          if (fileInput.files) {
            this.handleImageFiles(Array.from(fileInput.files), modalSelectedFiles, previewContainer);
            fileInput.value = '';
          }
        });
      },
      preConfirm: () => {
        const parkPlace = (document.getElementById('swal-park-place') as HTMLInputElement).value.trim();
        const adultsStr = (document.getElementById('swal-adults') as HTMLInputElement).value.trim();
        const adults = parseInt(adultsStr, 10);
        if (!parkPlace) {
          Swal.showValidationMessage('Parking place is required');
          return false;
        }
        if (!adultsStr || isNaN(adults) || adults < 1) {
          Swal.showValidationMessage('Adults is required (minimum 1)');
          return false;
        }
        const mileageStr = (document.getElementById('swal-mileage') as HTMLInputElement).value.trim();
        const mileageKm = mileageStr ? parseInt(mileageStr, 10) : undefined;
        const plateNo = (document.getElementById('swal-plate-no') as HTMLInputElement).value.trim() || undefined;
        const carModel = (document.getElementById('swal-car-model') as HTMLInputElement).value.trim() || undefined;
        const keepKeys = (document.getElementById('swal-keep-keys') as HTMLInputElement).checked;
        const parkingComments = (document.getElementById('swal-comments') as HTMLTextAreaElement).value.trim() || undefined;
        return { parkPlace, mileageKm, plateNo, carModel, adults, keepKeys, parkingComments, files: [...modalSelectedFiles] };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { parkPlace, files, ...extraFields } = result.value;
        this.performStatusUpdate(booking, newStatusId, newStatusLabel, parkPlace, undefined, extraFields);
        if (files.length > 0) {
          this.uploadBookingImages(booking.id, files);
        }
      }
    });
  }

  private uploadBookingImages(bookingId: string, files: File[]): void {
    this.bookingsService.uploadImages(bookingId, files).subscribe({
      next: (response) => {
        if (response.success) {
          const uploadedCount = response.data.urls.length;
          const failedCount = response.data.errors.length;
          let message = `${uploadedCount} photo${uploadedCount !== 1 ? 's' : ''} uploaded successfully`;
          if (failedCount > 0) {
            message += `, ${failedCount} failed`;
          }
          Swal.fire({
            icon: failedCount > 0 ? 'warning' : 'success',
            title: 'Photos Uploaded',
            text: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
      },
      error: (error) => {
        console.error('Error uploading images:', error);
        Swal.fire({
          icon: 'error',
          title: 'Upload Failed',
          text: 'Failed to upload vehicle photos. The parking place was saved successfully.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  private handleImageFiles(
    newFiles: File[],
    selectedFiles: File[],
    previewContainer: HTMLElement,
  ): void {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024;

    newFiles.forEach((file) => {
      if (!validTypes.includes(file.type)) return;
      if (file.size > maxSize) return;
      if (selectedFiles.some((f) => f.name === file.name && f.size === file.size)) return;
      selectedFiles.push(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText =
          'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;';

        const img = document.createElement('img');
        img.src = e.target?.result as string;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '&times;';
        removeBtn.style.cssText =
          'position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; border: none; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0;';
        removeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const idx = selectedFiles.indexOf(file);
          if (idx > -1) selectedFiles.splice(idx, 1);
          wrapper.remove();
        });

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        previewContainer.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
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
    extraFields?: { keepKeys?: boolean; mileageKm?: number; parkingComments?: string; plateNo?: string; carModel?: string; adults?: number },
  ): void {
    this.bookingsService
      .updateBookingStatus(booking.id, newStatusId, parkPlace, applyExtraFee, extraFields)
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
