import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Booking, DateRangeFilter, BookingImageInfo, BookingSortField, BookingSortDirection } from '../../../../shared/models/booking.model';
import { buildTelHref } from '../../../../shared/utils/phone.util';
import { BookingsService } from '../../../../core/services/bookings.service';
import { ApiService } from '../../../../core/services/api.service';
import { UserProfileService } from '../../../../core/services/user-profile.service';
import { ShiftService } from '../../../../core/services/shift.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { ZebraPrintService } from '../../../../core/services/zebra-print.service';
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
import { PRIMARY_COLOR } from '../../../../shared/constants/theme.constants';

export type PrintableDocType = 'booking-tag' | 'checkin-receipt' | 'checkin-payment' | 'completion-payment' | 'prepaid-payment';

@Component({
  selector: 'app-bookings-list',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule, NgbTooltipModule, CurrencyPipe, RouterModule, ImageCarouselComponent],
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
  @Input() isUser: boolean = false;
  @Input() dateRangeFilter: DateRangeFilter | null = null;
  @Input() sortField: BookingSortField | null = null;
  @Input() sortDirection: BookingSortDirection = 'asc';
  @Output() pageChange = new EventEmitter<number>();
  @Output() bookingDeleted = new EventEmitter<void>();
  @Output() bookingUpdated = new EventEmitter<void>();
  @Output() sortChange = new EventEmitter<BookingSortField>();

  onSortClick(field: BookingSortField): void {
    this.sortChange.emit(field);
  }

  sortIndicator(field: BookingSortField): string {
    if (this.sortField !== field) return '';
    return this.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  showCarousel = false;
  carouselImages: BookingImageInfo[] = [];
  carouselStartIndex = 0;

  constructor(
    private bookingsService: BookingsService,
    private apiService: ApiService,
    private userProfileService: UserProfileService,
    private shiftService: ShiftService,
    private settingsService: SettingsService,
    private zebraPrintService: ZebraPrintService,
  ) {}

  async reprintCheckinPayment(bookingId: string): Promise<void> {
    await this.zebraPrintService.printCheckinPaymentReceipt(bookingId);
  }

  async reprintCompletionPayment(bookingId: string): Promise<void> {
    await this.zebraPrintService.printCompletionPaymentReceipt(bookingId);
  }

  async reprintCheckinCarReceipt(bookingId: string): Promise<void> {
    await this.zebraPrintService.printCheckinReceipt(bookingId);
  }

  private async printThermalReceipt(receiptId: string): Promise<void> {
    await this.zebraPrintService.printThermalReceipt(receiptId);
  }

  async printPrepaidReceipt(booking: Booking): Promise<void> {
    await this.zebraPrintService.printPrepaidPaymentReceipt(booking.id);
  }

  async printBookingTag(bookingId: string): Promise<void> {
    await this.zebraPrintService.printBookingTag(bookingId);
  }

  private readonly printableDocs: Record<PrintableDocType, { label: string; print: (booking: Booking) => Promise<void>; emailEndpoint: (booking: Booking) => string }> = {
    'booking-tag': { label: 'Booking Tag', print: (b) => this.printBookingTag(b.id), emailEndpoint: (b) => `/bookings/${b.id}/booking-tag/email` },
    'checkin-receipt': { label: 'Check-in Receipt', print: (b) => this.reprintCheckinCarReceipt(b.id), emailEndpoint: (b) => `/bookings/${b.id}/checkin-receipt/email` },
    'checkin-payment': { label: 'Check-in Payment', print: (b) => this.reprintCheckinPayment(b.id), emailEndpoint: (b) => `/bookings/${b.id}/checkin-payment/email` },
    'completion-payment': { label: 'Checkout Payment', print: (b) => this.reprintCompletionPayment(b.id), emailEndpoint: (b) => `/bookings/${b.id}/completion-payment/email` },
    'prepaid-payment': { label: 'Pre-paid Receipt', print: (b) => this.printPrepaidReceipt(b), emailEndpoint: (b) => `/bookings/${b.id}/prepaid-payment/email` },
  };

  async chooseDeliveryMethod(booking: Booking, docType: PrintableDocType): Promise<void> {
    const doc = this.printableDocs[docType];
    const result = await Swal.fire({
      title: doc.label,
      text: `How would you like to receive the ${doc.label.toLowerCase()}?`,
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Print',
      denyButtonText: 'Email',
      cancelButtonText: 'Cancel',
      confirmButtonColor: PRIMARY_COLOR,
      denyButtonColor: '#6c757d',
    });

    if (result.isConfirmed) {
      await doc.print(booking);
    } else if (result.isDenied) {
      await this.promptAndSendEmail(booking, docType);
    }
  }

  private async promptAndSendEmail(booking: Booking, docType: PrintableDocType): Promise<void> {
    const doc = this.printableDocs[docType];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const { value: email } = await Swal.fire({
      title: `Email ${doc.label}`,
      input: 'email',
      inputLabel: 'Recipient email address',
      inputValue: booking.email || '',
      inputPlaceholder: 'customer@example.com',
      showCancelButton: true,
      confirmButtonText: 'Send',
      cancelButtonText: 'Cancel',
      confirmButtonColor: PRIMARY_COLOR,
      inputValidator: (value) => {
        if (!value || !emailRegex.test(value.trim())) {
          return 'Please enter a valid email address';
        }
        return undefined;
      },
    });

    if (!email) return;

    this.apiService.post<{ success: boolean }>(doc.emailEndpoint(booking), { email: email.trim() }).subscribe({
      next: () => {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `${doc.label} emailed successfully`,
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      },
      error: (err) => {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: err.error?.error || `Failed to email ${doc.label.toLowerCase()}`,
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  /** Customer self-service: opens the PDF directly (no Print/Email chooser — that dialog
   *  only makes sense for staff at a counter with a physical printer). */
  private openPdfBlob(endpoint: string, errorMessage: string): void {
    this.apiService.getBlob(endpoint).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: errorMessage,
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  downloadCheckinPaymentReceipt(booking: Booking): void {
    this.openPdfBlob(`/bookings/${booking.id}/checkin-payment/pdf`, 'Failed to load check-in payment receipt');
  }

  downloadCompletionPaymentReceipt(booking: Booking): void {
    this.openPdfBlob(`/bookings/${booking.id}/completion-payment/pdf`, 'Failed to load checkout payment receipt');
  }

  downloadPrepaidReceipt(booking: Booking): void {
    this.openPdfBlob(`/bookings/${booking.id}/prepaid-payment/pdf`, 'Failed to load pre-paid receipt');
  }

  canHaveImages(booking: Booking): boolean {
    return booking.bookingStatusId === 'bookingStatus_parked' || booking.bookingStatusId === 'bookingStatus_completed';
  }

  showParkingNote(booking: Booking, event: MouseEvent): void {
    event.stopPropagation();
    Swal.fire({
      title: 'Parking Note',
      text: booking.parkingComments ?? '',
      icon: 'info',
      confirmButtonText: 'Close',
      confirmButtonColor: PRIMARY_COLOR,
    });
  }

  openCarouselForBooking(bookingId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.bookingsService.getBookingImages(bookingId).subscribe({
      next: (response) => {
        if (response.success && response.data.images.length > 0) {
          this.carouselImages = response.data.images;
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
    if (!booking.dateTo) return '-';
    const date = new Date(booking.dateTo);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = booking.timeTo?.slice(0, -3) || '--:--';
    return `${dateStr} ${time}`;
  }

  formatNullableDateTime(dateTime: string | null): string {
    if (!dateTime) return '';
    const date = new Date(dateTime);
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

  getTelHref(booking: Booking): string | null {
    return buildTelHref(booking.phoneCode, booking.mobile);
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

  getPaymentBadgeClass(paymentStatus: string | null): string {
    switch (paymentStatus) {
      case 'paid':
        return 'bg-success';
      case 'partial':
        return 'bg-warning text-dark';
      case 'overpaid':
        return 'bg-info';
      case 'unpaid':
        return 'bg-danger';
      default:
        return '';
    }
  }

  getPaymentBadgeLabel(paymentStatus: string | null): string {
    switch (paymentStatus) {
      case 'paid':
        return 'Paid';
      case 'partial':
        return 'Partial';
      case 'overpaid':
        return 'Overpaid';
      case 'unpaid':
        return 'Unpaid';
      default:
        return '';
    }
  }

  async onStatusChange(booking: Booking, newStatusId: string): Promise<void> {
    const statusLabels: Record<string, string> = {
      bookingStatus_created: 'Created',
      bookingStatus_parked: 'Parked',
      bookingStatus_completed: 'Completed',
    };
    const newStatusLabel = statusLabels[newStatusId] || newStatusId;

    if (newStatusId === 'bookingStatus_parked' || newStatusId === 'bookingStatus_completed') {
      await this.shiftService.ensureShift();
    }

    if (newStatusId === 'bookingStatus_parked') {
      this.showParkPlaceAndImagesModal(booking, newStatusId, newStatusLabel);
    } else if (newStatusId === 'bookingStatus_completed') {
      this.handleCompletedStatus(booking, newStatusId, newStatusLabel);
    } else {
      this.performStatusUpdate(booking, newStatusId, newStatusLabel);
    }
  }

  private async handleCompletedStatus(
    booking: Booking,
    _newStatusId: string,
    _newStatusLabel: string,
  ): Promise<void> {
    // 1. Fetch extra fee estimate
    let extraFee = 0;
    let isLate = false;
    let walleePaymentDate: string | null = null;
    try {
      const estimateResp: any = await firstValueFrom(
        this.apiService.get<any>(`/bookings/${booking.id}/extra-fee-estimate`)
      );
      extraFee = estimateResp?.data?.extraFee ?? 0;
      isLate = estimateResp?.data?.isLate ?? false;
      walleePaymentDate = estimateResp?.data?.walleePaymentDate ?? null;
    } catch {
      // proceed without extra fee
    }

    // 2. Late checkout prompts
    let applyExtraFee = false;
    if (isLate && extraFee > 0) {
      const lateResult = await Swal.fire({
        title: 'Late Check-out Detected',
        html: `The actual check-out is later than scheduled.<br>Estimated extra fee: <strong>€${extraFee.toFixed(2)}</strong><br>Do you want to apply it?`,
        icon: 'question',
        showDenyButton: true,
        showCancelButton: false,
        showCloseButton: true,
        confirmButtonText: 'Apply extra fee',
        denyButtonText: 'Skip extra fee',
        confirmButtonColor: PRIMARY_COLOR,
        denyButtonColor: '#6c757d',
        allowOutsideClick: false,
        allowEscapeKey: true,
      });
      if (!lateResult.isConfirmed && !lateResult.isDenied) return;
      applyExtraFee = lateResult.isConfirmed;
    } else if (isLate) {
      const lateConfirm = await Swal.fire({
        title: 'Late Check-out',
        text: 'The actual check-out is later than scheduled. No extra fee will be applied.',
        icon: 'info',
        showCancelButton: false,
        confirmButtonText: 'Proceed',
        confirmButtonColor: PRIMARY_COLOR,
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      if (!lateConfirm.isConfirmed) return;
    }

    const totalAmount = (booking.finalPrice ?? 0) + (applyExtraFee ? extraFee : 0);
    const walleePaid = booking.walleePaidAmount ?? 0;
    const checkinPaid = (booking.paidAmount ?? 0) - walleePaid;
    const totalAlreadyPaid = booking.paidAmount ?? 0;
    const remainingBalance = parseFloat((totalAmount - totalAlreadyPaid).toFixed(2));
    const walleeDateStr = walleePaymentDate ? new Date(walleePaymentDate).toLocaleDateString() : '';

    // Build prior payments summary for notes
    const priorParts: string[] = [];
    if (walleePaid > 0) priorParts.push(`Pre-paid online via Wallee${walleeDateStr ? ` on ${walleeDateStr}` : ''} (€${walleePaid.toFixed(2)})`);
    if (checkinPaid > 0) priorParts.push(`Paid at check-in: €${checkinPaid.toFixed(2)}`);
    const priorNote = priorParts.join('. ');

    // 3. Payment collection
    let paymentMethod: string;
    let amount: number;
    let notes: string | undefined;

    if (remainingBalance <= 0) {
      // Everything already covered — just confirm
      paymentMethod = 'online';
      amount = 0;
      notes = priorNote ? `${priorNote}. No additional payment required.` : 'No additional payment required.';
      const confirmResult = await Swal.fire({
        title: 'Confirm Completion',
        html: `Booking is fully paid.<br><strong>Total paid: €${totalAlreadyPaid.toFixed(2)}</strong><br>No additional payment required.`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Complete Booking',
        cancelButtonText: 'Cancel',
        confirmButtonColor: PRIMARY_COLOR,
      });
      if (!confirmResult.isConfirmed) return;
    } else {
      // Remaining balance to collect at checkout
      const priorHtml = priorNote
        ? `<p style="margin-bottom:12px; color:#374151; font-size:14px;">${priorNote}.</p>`
        : '';
      const { value: formValues } = await Swal.fire({
        title: 'Collect Payment',
        html: `
          ${priorHtml}
          <div class="mb-3">
            <label class="form-label fw-semibold">Amount (€)</label>
            <input id="swal-amount" type="number" step="0.01" min="0" class="swal2-input" value="${remainingBalance.toFixed(2)}" style="width:100%;margin:0">
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold">Payment Method</label>
            <div class="d-flex gap-3 justify-content-center mt-2">
              <div class="form-check">
                <input class="form-check-input" type="radio" name="swal-pm" id="pm-cash" value="cash" checked>
                <label class="form-check-label" for="pm-cash">Cash</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="swal-pm" id="pm-card" value="card">
                <label class="form-check-label" for="pm-card">Card</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Complete Booking',
        cancelButtonText: 'Cancel',
        confirmButtonColor: PRIMARY_COLOR,
        preConfirm: () => {
          const amtEl = document.getElementById('swal-amount') as HTMLInputElement;
          const pmEl = document.querySelector('input[name="swal-pm"]:checked') as HTMLInputElement;
          return { amount: parseFloat(amtEl?.value || '0'), paymentMethod: pmEl?.value || 'cash' };
        },
      });
      if (!formValues) return;
      amount = formValues.amount;
      paymentMethod = formValues.paymentMethod;
      const pmCap = paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);
      notes = priorNote
        ? `${priorNote}. Collected at checkout: €${amount.toFixed(2)} (${pmCap}).`
        : `Collected at checkout: €${amount.toFixed(2)} (${pmCap}).`;
    }

    const actorName = this.userProfileService.getDisplayName() || undefined;

    // 4. Call complete endpoint
    this.apiService.post<any>(`/bookings/${booking.id}/complete`, {
      amount,
      paymentMethod,
      applyExtraFee,
      notes,
      actorName,
    }).subscribe({
      next: (res: any) => {
        booking.bookingStatusId = 'bookingStatus_completed';
        booking.bookingStatus = 'Completed';
        const receiptId = res?.data?.receiptId;
        if (receiptId) {
          Swal.fire({
            icon: 'success',
            title: 'Booking completed successfully',
            text: 'Would you like to print the receipt?',
            confirmButtonText: 'Print Receipt',
            showDenyButton: true,
            denyButtonText: 'Skip',
            denyButtonColor: '#6c757d',
          }).then((r) => {
            if (r.isConfirmed) {
              this.printThermalReceipt(receiptId);
            }
            this.bookingUpdated.emit();
          });
        } else {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Booking completed successfully',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
          this.bookingUpdated.emit();
        }
      },
      error: (err) => {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: err.error?.error || err.error?.message || 'Failed to complete booking',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  private async showParkPlaceAndImagesModal(
    booking: Booking,
    newStatusId: string,
    newStatusLabel: string,
  ): Promise<void> {
    const modalSelectedFiles: File[] = [];

    let mandatoryCheckInPayment = false;
    let exemptMandatoryPayment = false;
    let latestPaymentDate: string | null = null;
    try {
      const requests: Promise<any>[] = [
        firstValueFrom(this.settingsService.getSettings()),
        firstValueFrom(this.apiService.get<any>(`/bookings/${booking.id}/checkin-payment-info`)),
      ];
      if (booking.userId) {
        requests.push(firstValueFrom(this.apiService.get<any>(`/user/${booking.userId}/settings`)));
      }
      const [settingsResp, paymentInfoResp, userSettingsResp] = await Promise.all(requests);
      mandatoryCheckInPayment = settingsResp.mandatoryCheckInPayment ?? false;
      latestPaymentDate = paymentInfoResp?.data?.latestPaymentDate ?? null;
      exemptMandatoryPayment = userSettingsResp?.data?.exemptMandatoryPayment ?? false;
    } catch {
      // proceed with defaults
    }
    const effectiveMandatory = mandatoryCheckInPayment && !exemptMandatoryPayment;

    const finalPrice = booking.finalPrice ?? null;
    const paidAmount = booking.paidAmount ?? 0;
    const walleePaidCI = booking.walleePaidAmount ?? 0;
    const checkinPaidCI = paidAmount - walleePaidCI;
    const dateStr = latestPaymentDate ? new Date(latestPaymentDate).toLocaleDateString() : '';

    let paymentSectionHtml = '';
    let showPaymentFields = false;
    let prefilledAmount = 0;

    if (finalPrice === null) {
      paymentSectionHtml = `
        <div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:16px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; color:#64748b; font-size:13px; line-height:1.5;">
            ℹ️ Payment collection is not available because the check-out details are not set.
          </div>
        </div>`;
    } else if (paidAmount >= finalPrice) {
      let paidMsg = '';
      if (walleePaidCI >= finalPrice) {
        paidMsg = `✓ No payment required — booking was fully paid online (€${walleePaidCI.toFixed(2)}${dateStr ? ` at ${dateStr}` : ''}).`;
      } else if (checkinPaidCI >= finalPrice) {
        paidMsg = `✓ No payment required — booking was fully paid at check-in (€${checkinPaidCI.toFixed(2)}).`;
      } else {
        paidMsg = `✓ No payment required — booking is fully paid (online: €${walleePaidCI.toFixed(2)}, check-in: €${checkinPaidCI.toFixed(2)}).`;
      }
      paymentSectionHtml = `
        <div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:16px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px 14px; color:#15803d; font-size:13px; line-height:1.5;">
            ${paidMsg}
          </div>
        </div>`;
    } else {
      showPaymentFields = true;
      let infoHtml = '';
      if (paidAmount > 0) {
        const remaining = parseFloat((finalPrice - paidAmount).toFixed(2));
        prefilledAmount = remaining;
        const paidInfoParts: string[] = [];
        if (walleePaidCI > 0) paidInfoParts.push(`Paid online: €${walleePaidCI.toFixed(2)}${dateStr ? ` at ${dateStr}` : ''}`);
        if (checkinPaidCI > 0) paidInfoParts.push(`Paid at check-in: €${checkinPaidCI.toFixed(2)}`);
        infoHtml = `<div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:8px 12px; color:#1d4ed8; font-size:13px; margin-bottom:12px;">
          ℹ️ ${paidInfoParts.join('. ')}. Remaining balance: €${remaining.toFixed(2)}.
        </div>`;
      } else {
        prefilledAmount = finalPrice;
      }
      const fieldsHtml = `
        ${infoHtml}
        <div style="margin-bottom:12px;">
          <label style="display:block; font-weight:600; margin-bottom:6px; color:#374151; font-size:14px;">Amount (€)${effectiveMandatory ? ' <span style="color:#dc3545;">*</span>' : ''}</label>
          <input id="swal-checkin-amount" type="number" step="0.01" min="0" class="swal2-input" value="${prefilledAmount.toFixed(2)}" style="margin:0; width:100%; box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:6px; color:#374151; font-size:14px;">Payment Method</label>
          <div style="display:flex; gap:16px; margin-top:6px;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px;"><input type="radio" name="swal-checkin-pm" value="cash" checked style="width:16px;height:16px;"> Cash</label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px;"><input type="radio" name="swal-checkin-pm" value="card" style="width:16px;height:16px;"> Card</label>
          </div>
        </div>`;
      if (effectiveMandatory) {
        paymentSectionHtml = `
          <div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:16px;">
            <div style="font-weight:600; color:#374151; font-size:14px; margin-bottom:12px;">Check-in Payment <span style="color:#dc3545;">*</span></div>
            ${fieldsHtml}
          </div>`;
      } else {
        paymentSectionHtml = `
          <div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:16px;">
            <div id="swal-checkin-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:4px 0; user-select:none;">
              <span style="font-weight:600; color:${PRIMARY_COLOR}; font-size:14px;">Record check-in payment (optional)</span>
              <span id="swal-checkin-chevron" style="color:${PRIMARY_COLOR}; font-size:11px; font-weight:bold;">▶</span>
            </div>
            <div id="swal-checkin-body" style="display:none; margin-top:12px;">
              ${fieldsHtml}
            </div>
          </div>`;
      }
    }

    Swal.fire({
      title: 'Parked Details',
      html: `
        <div style="text-align: left;">
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Parking Place <span style="color: #dc3545;">*</span></label>
              <input id="swal-park-place" class="swal2-input" placeholder="_-___" style="margin: 0; width: 100%; box-sizing: border-box;" />
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
                Customer Keep Keys
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
          ${paymentSectionHtml}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      confirmButtonColor: PRIMARY_COLOR,
      width: 520,
      didOpen: () => {
        const parkPlaceInput = document.getElementById('swal-park-place') as HTMLInputElement;
        parkPlaceInput.value = '_-___';
        const EDITABLE = [0, 2, 3, 4];
        parkPlaceInput.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Unidentified') return; // mobile IME — handled by input event
          e.preventDefault();
          const v = parkPlaceInput.value;
          const chars = (v.length === 5 && v[1] === '-') ? v.split('') : '_-___'.split('');
          if (e.key === 'Backspace' || e.key === 'Delete') {
            for (let i = EDITABLE.length - 1; i >= 0; i--) {
              if (chars[EDITABLE[i]] !== '_') { chars[EDITABLE[i]] = '_'; break; }
            }
          } else if (e.key.length === 1) {
            for (const pos of EDITABLE) {
              if (chars[pos] === '_') {
                if (pos === 0 && /[A-Za-z]/.test(e.key)) { chars[0] = e.key.toUpperCase(); }
                else if (pos !== 0 && /[0-9]/.test(e.key)) { chars[pos] = e.key; }
                break;
              }
            }
          }
          parkPlaceInput.value = chars.join('');
        });
        parkPlaceInput.addEventListener('input', () => {
          const meaningful = parkPlaceInput.value.replace(/[^A-Za-z0-9]/g, '');
          const letter = (meaningful.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
          const digits = meaningful.replace(/[^0-9]/g, '').slice(0, 3);
          parkPlaceInput.value = (letter || '_') + '-' + digits.padEnd(3, '_');
        });
        parkPlaceInput.addEventListener('paste', (e: Event) => e.preventDefault());

        if (!effectiveMandatory && showPaymentFields) {
          const header = document.getElementById('swal-checkin-header');
          const body = document.getElementById('swal-checkin-body');
          const chevron = document.getElementById('swal-checkin-chevron');
          if (header && body && chevron) {
            header.addEventListener('click', () => {
              const isOpen = body.style.display !== 'none';
              body.style.display = isOpen ? 'none' : 'block';
              chevron.textContent = isOpen ? '▶' : '▼';
            });
          }
        }

        const uploadArea = document.getElementById('swal-image-upload-area')!;
        const fileInput = document.getElementById('swal-image-input') as HTMLInputElement;
        const previewContainer = document.getElementById('swal-image-preview')!;

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.style.borderColor = PRIMARY_COLOR;
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
            this.handleImageFiles(Array.from(e.dataTransfer.files), modalSelectedFiles, previewContainer);
          }
        });
        fileInput.addEventListener('change', () => {
          if (fileInput.files) {
            this.handleImageFiles(Array.from(fileInput.files), modalSelectedFiles, previewContainer);
            fileInput.value = '';
          }
        });
      },
      preConfirm: async () => {
        const parkPlace = (document.getElementById('swal-park-place') as HTMLInputElement).value.trim();
        if (!parkPlace) { Swal.showValidationMessage('Parking place is required'); return false; }
        if (!/^[A-Z]-\d{3}$/.test(parkPlace)) {
          Swal.showValidationMessage('Parking place must be in format A-000 (e.g., A-001)');
          return false;
        }
        try {
          const check = await firstValueFrom(this.bookingsService.checkParkPlaceAvailability(parkPlace, booking.id));
          if (!check.available) { Swal.showValidationMessage('This parking place is already occupied by another vehicle'); return false; }
        } catch {
          Swal.showValidationMessage('Could not verify parking place availability'); return false;
        }
        const adultsStr = (document.getElementById('swal-adults') as HTMLInputElement).value.trim();
        const adults = parseInt(adultsStr, 10);
        if (!adultsStr || isNaN(adults) || adults < 1) { Swal.showValidationMessage('Adults is required (minimum 1)'); return false; }

        let checkinPayment: { amount: number; paymentMethod: string; notes: string } | null = null;
        if (showPaymentFields) {
          const body = document.getElementById('swal-checkin-body');
          const isExpanded = effectiveMandatory || (body !== null && body.style.display !== 'none');
          if (isExpanded) {
            const amtEl = document.getElementById('swal-checkin-amount') as HTMLInputElement;
            const pmEl = document.querySelector('input[name="swal-checkin-pm"]:checked') as HTMLInputElement;
            const amount = parseFloat(amtEl?.value || '0');
            const paymentMethod = pmEl?.value || 'cash';
            if (effectiveMandatory && (!amtEl?.value || isNaN(amount) || amount <= 0)) {
              Swal.showValidationMessage('Check-in payment amount is required'); return false;
            }
            if (amount > 0) {
              const pmCap = paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);
              const noteParts: string[] = [];
              if (walleePaidCI > 0) noteParts.push(`Paid online: €${walleePaidCI.toFixed(2)}${dateStr ? ` at ${dateStr}` : ''}`);
              if (checkinPaidCI > 0) noteParts.push(`Previously collected at check-in: €${checkinPaidCI.toFixed(2)}`);
              const prevNote = noteParts.join('. ');
              const notes = prevNote
                ? `${prevNote}. Remaining balance collected at check-in: €${amount.toFixed(2)} (${pmCap}).`
                : `Full amount collected at check-in: €${amount.toFixed(2)} (${pmCap}).`;
              checkinPayment = { amount, paymentMethod, notes };
            }
          }
        }

        const mileageStr = (document.getElementById('swal-mileage') as HTMLInputElement).value.trim();
        const mileageKm = mileageStr ? parseInt(mileageStr, 10) : undefined;
        const plateNo = (document.getElementById('swal-plate-no') as HTMLInputElement).value.trim() || undefined;
        const carModel = (document.getElementById('swal-car-model') as HTMLInputElement).value.trim() || undefined;
        const keepKeys = (document.getElementById('swal-keep-keys') as HTMLInputElement).checked;
        const parkingComments = (document.getElementById('swal-comments') as HTMLTextAreaElement).value.trim() || undefined;
        return { parkPlace, mileageKm, plateNo, carModel, adults, keepKeys, parkingComments, files: [...modalSelectedFiles], checkinPayment };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { parkPlace, files, checkinPayment: payment, ...extraFields } = result.value;
        const actorName = this.userProfileService.getDisplayName() || undefined;
        this.performStatusUpdate(booking, newStatusId, newStatusLabel, parkPlace, undefined, extraFields, () => {
          if (payment) {
            this.apiService.post<any>(`/bookings/${booking.id}/checkin-payment`, { ...payment, actorName }).subscribe({
              next: (res: any) => {
                const receiptId = res?.data?.receiptId;
                if (receiptId) {
                  Swal.fire({
                    icon: 'success',
                    title: 'Check-in payment recorded',
                    text: 'Would you like to print the receipt?',
                    confirmButtonText: 'Print Receipt',
                    showDenyButton: true,
                    denyButtonText: 'Close',
                    denyButtonColor: '#6c757d',
                  }).then(async (r) => {
                    if (r.isConfirmed) {
                      await this.printThermalReceipt(receiptId);
                    }
                  }).then(() => this.generateAndShowCheckinReceipt(booking.id));
                } else {
                  this.generateAndShowCheckinReceipt(booking.id);
                }
              },
              error: () => {
                Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Booking parked but check-in payment could not be recorded', showConfirmButton: false, timer: 4000, timerProgressBar: true });
                this.generateAndShowCheckinReceipt(booking.id);
              },
            });
          } else {
            this.generateAndShowCheckinReceipt(booking.id);
          }
        });
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
          if (response.data.urls.length > 0) {
            const booking = this.bookings.find(b => b.id === bookingId);
            if (booking && !booking.thumbnailUrl) {
              booking.thumbnailUrl = response.data.urls[0];
            }
          }
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
      confirmButtonColor: PRIMARY_COLOR,
      cancelButtonColor: '#6c757d',
    }).then((result) => {
      if (result.isConfirmed) {
        this.performStatusUpdate(booking, 'bookingStatus_created', 'Created');
      }
    });
  }

  private generateAndShowCheckinReceipt(bookingId: string): void {
    Swal.fire({
      icon: 'info',
      title: 'Check-in Receipt',
      text: 'Would you like to print the check-in receipt for the customer?',
      confirmButtonText: 'Print Receipt',
      showDenyButton: true,
      denyButtonText: 'Skip',
      denyButtonColor: '#6c757d',
      confirmButtonColor: PRIMARY_COLOR,
    }).then(async (r) => {
      if (r.isConfirmed) {
        await this.zebraPrintService.printCheckinReceipt(bookingId);
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
    onSuccess?: () => void,
  ): void {
    const actorName = this.userProfileService.getDisplayName() || undefined;
    this.bookingsService
      .updateBookingStatus(booking.id, newStatusId, parkPlace, applyExtraFee, extraFields, actorName)
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
            onSuccess?.();
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
