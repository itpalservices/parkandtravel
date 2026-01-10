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
import { Subscription } from 'rxjs';
import { ParkingType, ParkingTypesResponse } from '../../shared';
import { PhoneCode } from '../../shared/models/phone-codes.model';

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
  private checkInDateSubscription?: Subscription;

  bookingForm!: FormGroup;
  parkingTypes: ParkingType[] = [];
  phoneCodes: PhoneCode[] = [];
  selectedPhoneCode: PhoneCode | null = null;
  phoneCodeSearch = '';
  washAvailable = false;
  washPrice: number | null = null;
  washServiceEnabled = false;

  minDate: NgbDateStruct;
  checkOutMinDate: NgbDateStruct;

  submitting = false;
  submitSuccess = false;
  submitError = '';

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
      vehicleModel: ['', [Validators.required, Validators.minLength(2)]],
      vehicleColor: ['', [Validators.required, Validators.minLength(2)]],
      flightNumber: ['', [Validators.required, Validators.minLength(2)]],
      checkInDate: [defaultCheckIn, Validators.required],
      checkInTime: ['10:00', Validators.required],
      checkOutDate: [defaultCheckOut, Validators.required],
      checkOutTime: ['10:00', Validators.required],
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
        }
      });
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
        if (response.parkingTypes.length > 0) {
          this.bookingForm.patchValue({ parkingType: response.parkingTypes[0].id });
        }
      },
      error: () => {
        this.parkingTypes = [
          { id: 'parkingType_covered', name: 'Covered', pricePerDay: null },
          { id: 'parkingType_uncovered', name: 'Un Covered', pricePerDay: null },
        ];
        this.washAvailable = false;
        this.washPrice = null;
        this.bookingForm.patchValue({ parkingType: 'parkingType_covered' });
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

  calculateTotalPrice(): number | null {
    const parkingType = this.getSelectedParkingType();
    if (!parkingType || parkingType.pricePerDay === null) return null;
    const days = this.calculateDays();
    let total = days * parkingType.pricePerDay;
    if (this.washServiceEnabled && this.washPrice !== null) {
      total += this.washPrice;
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

  goBack(): void {
    this.router.navigate(['/']);
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

    this.submitting = true;
    this.submitError = '';

    const formValue = this.bookingForm.value;
    const booking = {
      fullName: formValue.fullName.trim(),
      email: formValue.email.trim(),
      phoneCodeId: formValue.phoneCodeId,
      phone: formValue.phone.trim(),
      licensePlate: formValue.licensePlate.trim(),
      vehicleModel: formValue.vehicleModel.trim(),
      vehicleBrand: formValue.vehicleBrand.trim(),
      vehicleColor: formValue.vehicleColor.trim(),
      flightNumber: formValue.flightNumber?.trim() || null,
      checkInDate: this.formatDateForApi(formValue.checkInDate),
      checkInTime: formValue.checkInTime,
      checkOutDate: this.formatDateForApi(formValue.checkOutDate),
      checkOutTime: formValue.checkOutTime,
      parkingTypeId: formValue.parkingType,
      washService: this.washServiceEnabled,
    };

    this.apiService.post('/bookings/guest', booking).subscribe({
      next: () => {
        this.submitting = false;
        this.submitSuccess = true;
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err.error?.message || 'Failed to create booking. Please try again.';
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
    });
    this.washServiceEnabled = false;
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
