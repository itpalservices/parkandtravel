import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';
import { FormFieldErrorComponent } from '../../shared/components/form-field-error/form-field-error.component';
import { Subscription } from 'rxjs';

interface ParkingType {
  id: number;
  name: string;
  pricePerDay: number;
}

@Component({
  selector: 'app-guest-booking',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    NgbDatepickerModule,
    FormFieldErrorComponent
  ],
  templateUrl: './guest-booking.component.html',
  styleUrls: ['./guest-booking.component.scss']
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
    this.minDate = today;
    this.checkOutMinDate = today;
    this.initForm();
  }

  private initForm(): void {
    this.bookingForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)]],
      licensePlate: ['', [Validators.required, Validators.minLength(2)]],
      vehicleModel: ['', [Validators.required, Validators.minLength(2)]],
      flightNumber: [''],
      checkInDate: [null, Validators.required],
      checkInTime: ['10:00', Validators.required],
      checkOutDate: [null, Validators.required],
      checkOutTime: ['10:00', Validators.required],
      parkingType: ['', Validators.required]
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
    this.checkInDateSubscription = this.bookingForm.get('checkInDate')?.valueChanges.subscribe(
      (checkInDate: NgbDateStruct | null) => {
        if (checkInDate) {
          this.checkOutMinDate = { ...checkInDate };
          const checkOutDate = this.bookingForm.get('checkOutDate')?.value;
          if (checkOutDate && this.compareDates(checkOutDate, checkInDate) < 0) {
            this.bookingForm.patchValue({ checkOutDate: { ...checkInDate } });
          }
        }
      }
    );
  }

  loadParkingTypes(): void {
    this.apiService.get<ParkingType[]>('/parking-types').subscribe({
      next: (types) => {
        this.parkingTypes = types;
        if (types.length > 0) {
          this.bookingForm.patchValue({ parkingType: types[0].id.toString() });
        }
      },
      error: () => {
        this.parkingTypes = [
          { id: 1, name: 'Standard', pricePerDay: 10 },
          { id: 2, name: 'Premium', pricePerDay: 20 }
        ];
        this.bookingForm.patchValue({ parkingType: '1' });
      }
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
      Object.keys(this.bookingForm.controls).forEach(key => {
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
      flightNumber: formValue.flightNumber?.trim() || null,
      checkInDate: this.formatDateTimeForApi(formValue.checkInDate, formValue.checkInTime),
      checkOutDate: this.formatDateTimeForApi(formValue.checkOutDate, formValue.checkOutTime),
      parkingTypeId: parseInt(formValue.parkingType, 10)
    };

    this.apiService.post('/bookings/guest', booking).subscribe({
      next: () => {
        this.submitting = false;
        this.submitSuccess = true;
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err.error?.message || 'Failed to create booking. Please try again.';
      }
    });
  }

  private formatDateTimeForApi(date: NgbDateStruct, time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const d = new Date(date.year, date.month - 1, date.day, hours, minutes);
    return d.toISOString();
  }

  createAnotherBooking(): void {
    this.submitSuccess = false;
    this.bookingForm.reset({
      checkInTime: '10:00',
      checkOutTime: '10:00'
    });
    if (this.parkingTypes.length > 0) {
      this.bookingForm.patchValue({ parkingType: this.parkingTypes[0].id.toString() });
    }
  }
}
