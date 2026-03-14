import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  NgbDatepickerModule,
  NgbDateStruct,
  NgbCalendar,
  NgbDate,
  NgbDropdownModule,
} from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';
import { FormFieldErrorComponent } from '../../shared/components/form-field-error/form-field-error.component';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ParkingType, ParkingTypesResponse } from '../../shared';
import { PhoneCode } from '../../shared/models/phone-codes.model';
import { AvailabilityService, AvailabilityResult } from '../../core/services/availability.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-guest-booking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbDatepickerModule,
    NgbDropdownModule,
    FormFieldErrorComponent,
  ],
  templateUrl: './guest-booking.component.html',
  styleUrls: ['./guest-booking.component.scss'],
})
export class GuestBookingComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private calendar = inject(NgbCalendar);
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private availabilityService = inject(AvailabilityService);
  private checkInDateSubscription?: Subscription;
  private availabilitySubscription?: Subscription;

  bookingForm!: FormGroup;
  parkingTypes: ParkingType[] = [];
  phoneCodes: PhoneCode[] = [];
  selectedPhoneCode: PhoneCode | null = null;
  phoneCodeSearch = '';
  washAvailable = false;
  washPrice: number | null = null;
  washServiceEnabled = false;
  returnDetailsEnabled= false;
  deliveryFee: number | null = null;
  mandatoryPrePayment = false;

  minDate: NgbDateStruct;
  checkOutMinDate: NgbDateStruct;

  submitting = false;
  submitSuccess = false;
  submitError = '';
  createdBookingId: string | null = null;
  paymentInitiating = false;
  paymentError = '';
  showPaymentButtonOnSuccess = false;
  
  checkingAvailability = false;
  availabilityResult: AvailabilityResult | null = null;
  availabilityError = '';

  constructor() {
    const today = this.calendar.getToday();
    const tomorrow = this.calendar.getNext(today, 'd', 1);
    const dayAfterTomorrow = this.calendar.getNext(tomorrow, 'd', 1);
    this.minDate = tomorrow;
    this.checkOutMinDate = dayAfterTomorrow;
    this.initForm(tomorrow, dayAfterTomorrow);
  }

  private initForm(defaultCheckIn: NgbDateStruct, defaultCheckOut: NgbDateStruct): void {
    this.bookingForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phoneCodeId: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{6,15}$/)]],
      licensePlate: ['', [Validators.required, Validators.minLength(2)]],
      vehicleBrand: ['', [Validators.required, Validators.minLength(2)]],
      vehicleModel: [''],
      vehicleColor: [''],
      flightNumber: [''],
      checkInDate: [defaultCheckIn, Validators.required],
      checkInTime: ['10:00', Validators.required],
      dropOffOption: ['self_drive', Validators.required],
      checkOutDate: [defaultCheckOut],
      checkOutTime: ['10:00'],
      pickUpOption: ['self_pickup'],
      parkingType: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadParkingTypes();
    this.loadPhoneCodes();
    this.setupCheckInDateListener();
  }

  ngOnDestroy(): void {
    this.checkInDateSubscription?.unsubscribe();
    this.availabilitySubscription?.unsubscribe();
  }

  private setupCheckInDateListener(): void {
    this.checkInDateSubscription = this.bookingForm
      .get('checkInDate')
      ?.valueChanges.subscribe((checkInDate: NgbDateStruct | null) => {
        if (checkInDate) {
          const checkInNgbDate = new NgbDate(checkInDate.year, checkInDate.month, checkInDate.day);
          const nextDay = this.calendar.getNext(checkInNgbDate, 'd', 1);
          this.checkOutMinDate = nextDay;
          const checkOutDate = this.bookingForm.get('checkOutDate')?.value;
          if (checkOutDate && this.compareDates(checkOutDate, nextDay) < 0) {
            this.bookingForm.patchValue({ checkOutDate: nextDay });
          }
          this.checkAvailability();
        }
      });
  }

  checkAvailability(): void {
    const checkInDate = this.bookingForm.get('checkInDate')?.value;
    const checkOutDate = this.bookingForm.get('checkOutDate')?.value;
    const parkingType = this.bookingForm.get('parkingType')?.value;

    if (!checkInDate || !checkOutDate || !parkingType) {
      this.availabilityResult = null;
      return;
    }

    const dateFrom = this.formatDateForApi(checkInDate);
    const dateTo = this.formatDateForApi(checkOutDate);

    this.checkingAvailability = true;
    this.availabilityError = '';
    this.availabilitySubscription?.unsubscribe();

    this.availabilitySubscription = this.availabilityService
      .checkAvailability(dateFrom, dateTo, parkingType)
      .subscribe({
        next: (result) => {
          this.checkingAvailability = false;
          this.availabilityResult = result;
          if (!result.available) {
            this.availabilityError = result.message || 'No parking spots available for the selected dates';
          }
        },
        error: (err) => {
          this.checkingAvailability = false;
          this.availabilityResult = null;
          this.availabilityError = 'Failed to check availability';
        },
      });
  }

  onCheckOutDateChange(): void {
    this.checkAvailability();
  }

  onParkingTypeChange(): void {
    this.checkAvailability();
  }

  formatDate(date: NgbDateStruct | null): string {
    if (!date) return '';
    const day = date.day.toString().padStart(2, '0');
    const month = date.month.toString().padStart(2, '0');
    return `${day}/${month}/${date.year}`;
  }

  loadParkingTypes(): void {
    this.apiService.get<ParkingTypesResponse>('/parking-types').subscribe({
      next: (response) => {
        this.parkingTypes = response.parkingTypes;
        this.washAvailable = response.washAvailable;
        this.washPrice = response.washPrice;
        this.deliveryFee = response.deliveryFee;
        this.mandatoryPrePayment = response.mandatoryPrePayment ?? false;
        if (response.parkingTypes.length > 0) {
          this.bookingForm.patchValue({ parkingType: response.parkingTypes[0].id });
          this.checkAvailability();
        }
      },
      error: () => {
        this.parkingTypes = [
          { id: 'parkingType_covered', name: 'Covered', pricePerDay: null, priceIncrements: null },
          { id: 'parkingType_uncovered', name: 'Un Covered', pricePerDay: null, priceIncrements: null },
        ];
        this.washAvailable = false;
        this.washPrice = null;
        this.mandatoryPrePayment = false;
        this.bookingForm.patchValue({ parkingType: 'parkingType_covered' });
        this.checkAvailability();
      },
    });
  }

  toggleWashService(): void {
    this.washServiceEnabled = !this.washServiceEnabled;
  }

  getSelectedParkingType(): ParkingType | undefined {
    const selectedId = this.bookingForm.get('parkingType')?.value;
    return this.parkingTypes.find((t) => t.id === selectedId);
  }

  calculateDays(): number {
    const checkIn = this.bookingForm.get('checkInDate')?.value;
    const checkOut = this.bookingForm.get('checkOutDate')?.value;
    if (!checkIn || !checkOut) return 0;
    const checkInDate = new Date(checkIn.year, checkIn.month - 1, checkIn.day);
    const checkOutDate = new Date(checkOut.year, checkOut.month - 1, checkOut.day);
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 1);
  }

  get hasDeliveryFee(): boolean {
    if (this.deliveryFee === null) return false;
    const dropOff = this.bookingForm.get('dropOffOption')?.value;
    const pickUp = this.bookingForm.get('pickUpOption')?.value;
    const dropOffMatch = dropOff === 'airport_pickup';
    const pickUpMatch = this.returnDetailsEnabled && pickUp === 'airport_delivery';
    return dropOffMatch || pickUpMatch;
  }

  calculateProgressivePrice(basePrice: number, days: number, increments: number[] | null): number {
    let price = basePrice;
    for (let day = 2; day <= days; day++) {
      const idx = day - 2;
      const increment = increments && increments.length > 0
        ? (idx < increments.length ? increments[idx] : increments[increments.length - 1])
        : 0;
      price += increment;
    }
    return price;
  }

  calculateTotalPrice(): number | null {
    const parkingType = this.getSelectedParkingType();
    if (!parkingType || parkingType.pricePerDay === null) return null;
    const days = this.calculateDays();
    let total = this.calculateProgressivePrice(parkingType.pricePerDay, days, parkingType.priceIncrements);
    if (this.washServiceEnabled && this.washPrice !== null) {
      total += this.washPrice;
    }
    if (this.hasDeliveryFee && this.deliveryFee !== null) {
      total += this.deliveryFee;
    }
    return total;
  }

  loadPhoneCodes(): void {
    this.apiService.get<PhoneCode[]>('/phone-codes').subscribe({
      next: (codes) => {
        this.phoneCodes = codes;
        const cyprusCode = codes.find((c) => c.isoCode === 'CY');
        if (cyprusCode) {
          this.selectPhoneCode(cyprusCode);
        } else if (codes.length > 0) {
          this.selectPhoneCode(codes[0]);
        }
      },
      error: () => {
        this.phoneCodes = [{ id: 'default', isoCode: 'CY', phoneCode: '+357' }];
        this.selectPhoneCode(this.phoneCodes[0]);
      },
    });
  }

  selectPhoneCode(code: PhoneCode): void {
    this.selectedPhoneCode = code;
    this.bookingForm.patchValue({ phoneCodeId: code.id });
    this.phoneCodeSearch = '';
  }

  getFlagUrl(isoCode: string): string {
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }

  get filteredPhoneCodes(): PhoneCode[] {
    if (!this.phoneCodeSearch.trim()) {
      return this.phoneCodes;
    }
    const search = this.phoneCodeSearch.toLowerCase().trim();
    return this.phoneCodes.filter(
      (code) => code.isoCode.toLowerCase().includes(search) || code.phoneCode.includes(search),
    );
  }

  private compareDates(date1: NgbDateStruct, date2: NgbDateStruct): number {
    if (date1.year !== date2.year) return date1.year - date2.year;
    if (date1.month !== date2.month) return date1.month - date2.month;
    return date1.day - date2.day;
  }

  isDateDisabled = (date: NgbDateStruct): boolean => {
    return this.compareDates(date, this.minDate) < 0;
  };

  isCheckOutDateDisabled = (date: NgbDateStruct): boolean => {
    return this.compareDates(date, this.checkOutMinDate) < 0;
  };

  onCheckInDateSelect(date: NgbDateStruct): void {
    this.bookingForm.patchValue({ checkInDate: date });
  }

  onCheckOutDateSelect(date: NgbDateStruct): void {
    this.bookingForm.patchValue({ checkOutDate: date });
  }

  toggleReturnDetails(): void {
    this.returnDetailsEnabled = !this.returnDetailsEnabled;
    const returnFields = ['flightNumber', 'checkOutDate', 'checkOutTime', 'pickUpOption'];
    if (this.returnDetailsEnabled) {
      this.bookingForm.get('flightNumber')?.setValidators([Validators.required]);
      this.bookingForm.get('checkOutDate')?.setValidators([Validators.required]);
      this.bookingForm.get('checkOutTime')?.setValidators([Validators.required]);
      this.bookingForm.get('pickUpOption')?.setValidators([Validators.required]);
    } else {
      returnFields.forEach(field => {
        this.bookingForm.get(field)?.clearValidators();
      });
    }
    returnFields.forEach(field => {
      this.bookingForm.get(field)?.updateValueAndValidity();
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  get isPriceTBC(): boolean {
    return !this.returnDetailsEnabled;
  }

  get f() {
    return this.bookingForm.controls;
  }

  hasError(fieldName: string): boolean {
    const control = this.bookingForm.get(fieldName);
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  submitBooking(): void {
    if (this.bookingForm.invalid) {
      Object.keys(this.bookingForm.controls).forEach((key) => {
        this.bookingForm.get(key)?.markAsTouched();
      });
      return;
    }

    if (this.availabilityResult && !this.availabilityResult.available) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: this.availabilityError || 'No parking spots available for the selected dates',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
      });
      return;
    }

    const formValue = this.bookingForm.value;
    const bookingData: Record<string, any> = {
      fullName: formValue.fullName.trim(),
      email: formValue.email.trim(),
      phoneCodeId: formValue.phoneCodeId,
      phone: formValue.phone.trim(),
      licensePlate: formValue.licensePlate.trim(),
      vehicleModel: formValue.vehicleModel?.trim(),
      vehicleBrand: formValue.vehicleBrand.trim(),
      vehicleColor: formValue.vehicleColor?.trim(),
      checkInDate: this.formatDateForApi(formValue.checkInDate),
      checkInTime: formValue.checkInTime,
      dropOffOption: formValue.dropOffOption,
      parkingTypeId: formValue.parkingType,
      washService: this.washServiceEnabled,
      flightNumber: this.returnDetailsEnabled ? (formValue.flightNumber?.trim() || null) : null,
      checkOutDate: this.returnDetailsEnabled && formValue.checkOutDate ? this.formatDateForApi(formValue.checkOutDate) : null,
      checkOutTime: this.returnDetailsEnabled ? formValue.checkOutTime : null,
      pickUpOption: this.returnDetailsEnabled ? formValue.pickUpOption : null,
    };

    if (this.mandatoryPrePayment && !this.isPriceTBC) {
      this.submitting = true;
      this.submitError = '';
      this.apiService.post<{ paymentUrl: string }>('/payment/initiate', bookingData).subscribe({
        next: (res) => {
          window.location.href = res.paymentUrl;
        },
        error: (err) => {
          this.submitting = false;
          this.submitError = err.error?.message || 'Failed to initiate payment. Please try again.';
        },
      });
      return;
    }

    this.submitting = true;
    this.submitError = '';

    this.apiService.post<{ id: string; finalPrice: number | null }>('/bookings/guest', bookingData).subscribe({
      next: (res) => {
        this.submitting = false;
        this.submitSuccess = true;
        this.createdBookingId = res.id || null;
        this.showPaymentButtonOnSuccess = !this.mandatoryPrePayment && !this.isPriceTBC;
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err.error?.message || 'Failed to create booking. Please try again.';
      },
    });
  }

  proceedToPayment(): void {
    if (!this.createdBookingId) return;
    this.paymentInitiating = true;
    this.paymentError = '';
    this.apiService.post<{ paymentUrl: string }>('/payment/initiate-for-booking', { bookingId: this.createdBookingId }).subscribe({
      next: (res) => {
        window.location.href = res.paymentUrl;
      },
      error: (err) => {
        this.paymentInitiating = false;
        this.paymentError = err.error?.message || 'Failed to initiate payment. Please try again.';
      },
    });
  }

  private formatDateForApi(date: NgbDateStruct): string {
    const year = date.year;
    const month = date.month.toString().padStart(2, '0');
    const day = date.day.toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  createAnotherBooking(): void {
    this.submitSuccess = false;
    const today = this.calendar.getToday();
    const tomorrow = this.calendar.getNext(today, 'd', 1);
    const dayAfterTomorrow = this.calendar.getNext(tomorrow, 'd', 1);
    this.minDate = tomorrow;
    this.checkOutMinDate = dayAfterTomorrow;
    this.bookingForm.reset({
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      checkInTime: '10:00',
      checkOutTime: '10:00',
      dropOffOption: 'self_drive',
      pickUpOption: 'self_pickup',
    });
    this.washServiceEnabled = false;
    this.showPaymentButtonOnSuccess = false;
    this.createdBookingId = null;
    if (this.parkingTypes.length > 0) {
      this.bookingForm.patchValue({ parkingType: this.parkingTypes[0].id });
    }
    const cyprusCode = this.phoneCodes.find((c) => c.isoCode === 'CY');
    if (cyprusCode) {
      this.selectPhoneCode(cyprusCode);
    } else if (this.phoneCodes.length > 0) {
      this.selectPhoneCode(this.phoneCodes[0]);
    }
  }
}
