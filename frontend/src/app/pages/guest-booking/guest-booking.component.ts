import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  NgbDatepickerModule,
  NgbDateStruct,
  NgbCalendar,
  NgbDate,
} from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';
import { FormFieldErrorComponent } from '../../shared/components/form-field-error/form-field-error.component';
import { Subscription } from 'rxjs';

interface ParkingType {
  id: string;
  name: string;
  pricePerDay?: number;
}

@Component({
  selector: 'app-guest-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDatepickerModule, FormFieldErrorComponent],
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
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/),
        ],
      ],
      licensePlate: ['', [Validators.required, Validators.minLength(2)]],
      vehicleBrand: ['', [Validators.required, Validators.minLength(2)]],
      vehicleModel: ['', [Validators.required, Validators.minLength(2)]],
      vehicleColor: ['', [Validators.required, Validators.minLength(2)]],
      flightNumber: ['', [Validators.required]],
      checkInDate: [defaultCheckIn, Validators.required],
      checkInTime: ['10:00', Validators.required],
      checkOutDate: [defaultCheckOut, Validators.required],
      checkOutTime: ['10:00', Validators.required],
      parkingType: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadParkingTypes();
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
    this.apiService.get<ParkingType[]>('/parking-types').subscribe({
      next: (types) => {
        this.parkingTypes = types;
        if (types.length > 0) {
          this.bookingForm.patchValue({ parkingType: types[0].id });
        }
      },
      error: () => {
        this.parkingTypes = [
          { id: 'parkingType_covered', name: 'Covered' },
          { id: 'parkingType_uncovered', name: 'Un Covered' },
        ];
        this.bookingForm.patchValue({ parkingType: 'parkingType_covered' });
      },
    });
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
    if (this.parkingTypes.length > 0) {
      this.bookingForm.patchValue({ parkingType: this.parkingTypes[0].id });
    }
  }
}
