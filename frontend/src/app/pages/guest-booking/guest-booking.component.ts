import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbDatepickerModule, NgbDateStruct, NgbCalendar } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../core/services/api.service';

interface ParkingType {
  id: number;
  name: string;
  pricePerDay: number;
}

@Component({
  selector: 'app-guest-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbDatepickerModule],
  templateUrl: './guest-booking.component.html',
  styleUrls: ['./guest-booking.component.scss']
})
export class GuestBookingComponent implements OnInit {
  private router = inject(Router);
  private calendar = inject(NgbCalendar);
  private apiService = inject(ApiService);

  fullName = '';
  email = '';
  phone = '';
  licensePlate = '';
  vehicleModel = '';
  flightNumber = '';
  
  checkInDate: NgbDateStruct | null = null;
  checkInTime = '10:00';
  checkOutDate: NgbDateStruct | null = null;
  checkOutTime = '10:00';
  
  selectedParkingType = '';
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
  }

  ngOnInit(): void {
    this.loadParkingTypes();
  }

  loadParkingTypes(): void {
    this.apiService.get<ParkingType[]>('/parking-types').subscribe({
      next: (types) => {
        this.parkingTypes = types;
        if (types.length > 0) {
          this.selectedParkingType = types[0].id.toString();
        }
      },
      error: () => {
        this.parkingTypes = [
          { id: 1, name: 'Standard', pricePerDay: 10 },
          { id: 2, name: 'Premium', pricePerDay: 20 }
        ];
        this.selectedParkingType = '1';
      }
    });
  }

  onCheckInDateChange(): void {
    if (this.checkInDate) {
      this.checkOutMinDate = { ...this.checkInDate };
      if (this.checkOutDate && this.compareDates(this.checkOutDate, this.checkInDate) < 0) {
        this.checkOutDate = { ...this.checkInDate };
      }
    }
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

  isFormValid(): boolean {
    return !!(
      this.fullName.trim() &&
      this.email.trim() &&
      this.phone.trim() &&
      this.licensePlate.trim() &&
      this.vehicleModel.trim() &&
      this.checkInDate &&
      this.checkOutDate &&
      this.selectedParkingType
    );
  }

  submitBooking(): void {
    if (!this.isFormValid()) return;

    this.submitting = true;
    this.submitError = '';

    const booking = {
      fullName: this.fullName.trim(),
      email: this.email.trim(),
      phone: this.phone.trim(),
      licensePlate: this.licensePlate.trim(),
      vehicleModel: this.vehicleModel.trim(),
      flightNumber: this.flightNumber.trim() || null,
      checkInDate: this.formatDateTimeForApi(this.checkInDate!, this.checkInTime),
      checkOutDate: this.formatDateTimeForApi(this.checkOutDate!, this.checkOutTime),
      parkingTypeId: parseInt(this.selectedParkingType, 10)
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
    this.fullName = '';
    this.email = '';
    this.phone = '';
    this.licensePlate = '';
    this.vehicleModel = '';
    this.flightNumber = '';
    this.checkInDate = null;
    this.checkOutDate = null;
  }
}
