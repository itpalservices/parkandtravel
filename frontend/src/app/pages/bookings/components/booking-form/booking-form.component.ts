import { Component, inject, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NgbDatepickerModule,
  NgbDateStruct,
  NgbCalendar,
  NgbDate,
  NgbDropdownModule,
  NgbModal,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../../core/services/api.service';
import { FormFieldErrorComponent } from '../../../../shared/components/form-field-error/form-field-error.component';
import { Subscription, take } from 'rxjs';
import { BookingDetails, ParkingType, ParkingTypesResponse } from '../../../../shared';
import { PhoneCode } from '../../../../shared/models/phone-codes.model';
import { RoleService, UserRoleInfo } from '../../../../core/services/role.service';
import { UserProfile, Car } from '../../../../shared/models/user-profile.model';
import Swal from 'sweetalert2';
import { AuthService } from '@auth0/auth0-angular';
import { FormAction } from '../../../../shared/enums/form-action.enum';
import { FlightService } from '../../../../core/services/flight.service';

enum FormType {
  NewBooking,
  ExistingBooking
}

@Component({
  selector: 'app-booking-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbDatepickerModule,
    NgbDropdownModule,
    FormFieldErrorComponent,
  ],
  templateUrl: './booking-form.component.html',
  styleUrls: ['./booking-form.component.scss'],
})
export class BookingFormComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private calendar = inject(NgbCalendar);
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private roleService = inject(RoleService);
  private modalService = inject(NgbModal);
  private checkInDateSubscription?: Subscription;

  @ViewChild('addCarModal') addCarModal!: TemplateRef<unknown>;

  bookingForm!: FormGroup;
  carForm!: FormGroup;
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
  flightValidated = false;
  flightValidating = false;
  private flightService = inject(FlightService);
  
  isRegularUser = false;
  isAdminOrDriver = false;
  userProfile: UserProfile | null = null;
  cars: Car[] = [];
  selectedCar: Car | null = null;
  carsLoading = false;
  profileLoading = false;
  savingCar = false;
  private modalRef: NgbModalRef | null = null;

  searchingUser = false;
  foundUserId: string | null = null;
  userSearched = false;
  pendingFoundUserData: { fullName?: string; phone?: string; phoneCode?: string } | null = null;

  readonly formType: FormType;
  bookingId: string | null = null;
  loadingBooking = false;
  existingBooking: BookingDetails | null = null;

  currentStatusId: string | null = null;
  currentStatusLabel: string | null = null;
  parkPlace: string = '';
  updatingStatus = false;
  isBookingParked = false;

  constructor(private authService: AuthService, private _activatedRoute: ActivatedRoute) {
    const [{path}] = this._activatedRoute.snapshot.url;

    this.formType = path === FormAction.Add ? FormType.NewBooking : FormType.ExistingBooking;
    
    if (this.formType === FormType.ExistingBooking) {
      this.bookingId = this._activatedRoute.snapshot.paramMap.get('id');
    }

    this.authService.user$.pipe(take(1)).subscribe(user => {
      if (user) {
        if (!user.email_verified) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'Email not verified',
            html: 'Please verify your email. <a id="profile-link" href="javascript:void(0)" style="color: #006B8F; font-weight: 500; text-decoration: underline; cursor: pointer;">Go to Profile</a>',
            showConfirmButton: false,
            timer: 6000,
            timerProgressBar: true,
            didOpen: () => {
              const link = document.getElementById('profile-link');
              if (link) {
                link.addEventListener('click', () => {
                  Swal.close();
                  this.router.navigate(['/admin/user-profile']);
                });
              }
            }
          });
          this.router.navigate(['/bookings']);
        }
      }
    });
    
    const today = this.calendar.getToday();
    const tomorrow = this.calendar.getNext(today, 'd', 1);
    const dayAfterTomorrow = this.calendar.getNext(tomorrow, 'd', 1);
    this.minDate = today;
    this.checkOutMinDate = this.calendar.getNext(today, 'd', 1);
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
      checkOutDate: [defaultCheckOut, Validators.required],
      checkOutTime: ['10:00', Validators.required],
      pickUpOption: ['self_pickup', Validators.required],
      parkingType: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.roleService.getUserRole().pipe(take(1)).subscribe(roleInfo => {
      if (roleInfo.isDriver) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: 'Drivers cannot create or edit bookings',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
        this.router.navigate(['/admin/bookings']);
        return;
      }
      
      this.loadParkingTypes();
      this.loadPhoneCodes();
      this.setupCheckInDateListener();
      this.initCarForm();
      
      if (this.isEditMode && this.bookingId) {
        this.loadBookingDetails();
      } else {
        this.checkUserRole();
      }
    });
  }

  get isEditMode(): boolean {
    return this.formType === FormType.ExistingBooking;
  }

  private loadBookingDetails(): void {
    if (!this.bookingId) return;
    
    this.loadingBooking = true;
    this.apiService.get<BookingDetails>(`/bookings/${this.bookingId}`).subscribe({
      next: (booking) => {
        if (booking.bookingStatusId === 'bookingStatus_completed') {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'This booking is completed and cannot be edited',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
          });
          this.router.navigate(['/admin/bookings']);
          return;
        }
        
        this.existingBooking = booking;
        this.populateFormWithBookingData(booking);
        this.loadingBooking = false;
        if (booking.returnFlight) {
          this.flightValidated = true;
        }
        this.checkUserRole();
      },
      error: (err) => {
        console.error('Error loading booking:', err);
        this.loadingBooking = false;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: 'Failed to load booking details',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
        this.router.navigate(['/admin/bookings']);
      },
    });
  }

  private populateFormWithBookingData(booking: BookingDetails): void {
    const fullName = `${booking.name} ${booking.surname}`.trim();
    
    const checkInDate = this.parseApiDate(booking.dateFrom);
    const checkOutDate = this.parseApiDate(booking.dateTo);
    const checkInTime = booking.timeFrom ? booking.timeFrom.substring(0, 5) : '10:00';
    const checkOutTime = booking.timeTo ? booking.timeTo.substring(0, 5) : '10:00';

    this.bookingForm.patchValue({
      fullName: fullName,
      email: booking.email || '',
      phone: booking.mobile || '',
      licensePlate: booking.plateNo || '',
      vehicleBrand: booking.carBrand || '',
      vehicleModel: booking.carModel || '',
      vehicleColor: booking.carColor || '',
      flightNumber: booking.returnFlight || '',
      checkInDate: checkInDate,
      checkInTime: checkInTime,
      dropOffOption: booking.dropOffOption || 'self_drive',
      checkOutDate: checkOutDate,
      checkOutTime: checkOutTime,
      pickUpOption: booking.pickUpOption || 'self_pickup',
      parkingType: booking.parkingTypeId || '',
    });

    if (checkInDate) {
      const checkInNgbDate = new NgbDate(checkInDate.year, checkInDate.month, checkInDate.day);
      this.checkOutMinDate = this.calendar.getNext(checkInNgbDate, 'd', 1);
    }

    this.washServiceEnabled = booking.washService;

    if (booking.phoneCodeId && this.phoneCodes.length > 0) {
      const matchingCode = this.phoneCodes.find(c => c.id === booking.phoneCodeId);
      if (matchingCode) {
        this.selectPhoneCode(matchingCode, false);
      }
    }

    if (booking.userId) {
      this.foundUserId = booking.userId;
    }

    this.currentStatusId = booking.bookingStatusId;
    this.currentStatusLabel = booking.bookingStatus;
    this.parkPlace = booking.parkPlace || '';
    this.isBookingParked = booking.bookingStatusId === 'bookingStatus_parked';

    this.bookingForm.get('fullName')?.disable();
    this.bookingForm.get('email')?.disable();
    this.bookingForm.get('phone')?.disable();
    this.bookingForm.get('phoneCodeId')?.disable();

    if (this.isBookingParked) {
      this.disableFieldsForParkedBooking();
    }
  }

  private disableFieldsForParkedBooking(): void {
    const allFormFields = Object.keys(this.bookingForm.controls);
    const fieldsToKeepEnabled = ['pickUpOption'];
    
    allFormFields.forEach(field => {
      if (!fieldsToKeepEnabled.includes(field)) {
        this.bookingForm.get(field)?.disable();
      } else {
        this.bookingForm.get(field)?.enable();
      }
    });
  }

  canToggleWashService(): boolean {
    return this.washAvailable && (!this.isBookingParked || (this.isBookingParked && this.washAvailable));
  }

  private enableFieldsForNonParkedBooking(): void {
    const fieldsAlwaysDisabled = ['fullName', 'email', 'phone', 'phoneCodeId'];
    const allFormFields = Object.keys(this.bookingForm.controls);
    
    allFormFields.forEach(field => {
      if (!fieldsAlwaysDisabled.includes(field)) {
        this.bookingForm.get(field)?.enable();
      }
    });
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

  onStatusChange(newStatusId: string): void {
    if (!this.bookingId) return;
    
    const statusLabels: Record<string, string> = {
      bookingStatus_created: 'Created',
      bookingStatus_parked: 'Parked',
      bookingStatus_completed: 'Completed',
    };
    const newStatusLabel = statusLabels[newStatusId] || newStatusId;

    if (newStatusId === 'bookingStatus_parked') {
      this.showParkPlaceModal(newStatusId, newStatusLabel);
    } else if (newStatusId === 'bookingStatus_completed') {
      this.handleCompletedStatus(newStatusId, newStatusLabel);
    } else {
      this.performStatusUpdate(newStatusId, newStatusLabel);
    }
  }

  private showParkPlaceModal(newStatusId: string, newStatusLabel: string): void {
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
        this.performStatusUpdate(newStatusId, newStatusLabel, result.value.trim());
      }
    });
  }

  private handleCompletedStatus(newStatusId: string, newStatusLabel: string): void {
    if (!this.existingBooking) return;
    
    const checkOutDate = new Date(this.existingBooking.dateTo);
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
          this.performStatusUpdate(newStatusId, newStatusLabel, undefined, true);
        } else if (result.isDenied) {
          this.performStatusUpdate(newStatusId, newStatusLabel, undefined, false);
        }
      });
    } else {
      this.performStatusUpdate(newStatusId, newStatusLabel);
    }
  }

  private performStatusUpdate(newStatusId: string, newStatusLabel: string, parkPlace?: string, applyExtraFee?: boolean): void {
    if (!this.bookingId) return;
    
    this.updatingStatus = true;
    const body: { bookingStatusId: string; parkPlace?: string; applyExtraFee?: boolean } = { bookingStatusId: newStatusId };
    if (parkPlace) body.parkPlace = parkPlace;
    if (applyExtraFee !== undefined) body.applyExtraFee = applyExtraFee;

    this.apiService.patch(`/bookings/${this.bookingId}/status`, body).subscribe({
      next: () => {
        this.updatingStatus = false;
        this.currentStatusId = newStatusId;
        this.currentStatusLabel = newStatusLabel;
        if (parkPlace) this.parkPlace = parkPlace;
        
        this.isBookingParked = newStatusId === 'bookingStatus_parked';
        
        if (newStatusId === 'bookingStatus_parked') {
          this.disableFieldsForParkedBooking();
        } else if (newStatusId === 'bookingStatus_created') {
          this.parkPlace = '';
          this.enableFieldsForNonParkedBooking();
        } else if (newStatusId === 'bookingStatus_completed') {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Booking completed successfully',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
          this.router.navigate(['/admin/bookings']);
          return;
        }

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Status updated to ${newStatusLabel}`,
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      },
      error: (err) => {
        this.updatingStatus = false;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: err.error?.error || err.error?.message || 'Failed to update status',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  onRevertToCreated(): void {
    if (!this.bookingId) return;
    
    Swal.fire({
      title: 'Revert to Created?',
      html: 'This will change the booking status back to <strong>Created</strong>.<br><br><small class="text-muted">Note: The parking place information will be cleared.</small>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, revert',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#006B8F',
    }).then((result) => {
      if (result.isConfirmed) {
        this.performStatusUpdate('bookingStatus_created', 'Created');
      }
    });
  }

  private parseApiDate(dateStr: string): NgbDateStruct | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
    };
  }

  private initCarForm(): void {
    this.carForm = this.fb.group({
      carBrand: ['', [Validators.required, Validators.minLength(2)]],
      carModel: ['', [Validators.required, Validators.minLength(2)]],
      carColor: ['', [Validators.required, Validators.minLength(2)]],
      plateNo: ['', [Validators.required, Validators.minLength(2)]],
    });
  }

  private checkUserRole(): void {
    this.roleService.getUserRole().subscribe({
      next: (roleInfo: UserRoleInfo) => {
        this.isRegularUser = roleInfo.isUser;
        this.isAdminOrDriver = roleInfo.isAdmin || roleInfo.isDriver;
        
        if (this.isRegularUser) {
          this.loadUserProfile();
          this.loadUserCars();
        } else if (this.isAdminOrDriver) {
          this.initAdminDriverForm();
        }
      },
    });
  }

  private initAdminDriverForm(): void {
    this.bookingForm.get('phone')?.disable();
    this.bookingForm.get('phoneCodeId')?.disable();
    this.bookingForm.get('fullName')?.disable();
  }

  private applyFoundUserData(data: { fullName?: string; phone?: string; phoneCode?: string }): void {
    if (data.fullName) {
      this.bookingForm.patchValue({ fullName: data.fullName });
      this.bookingForm.get('fullName')?.disable();
    } else {
      this.bookingForm.get('fullName')?.enable();
    }

    if (data.phone) {
      this.bookingForm.patchValue({ phone: data.phone });
      this.bookingForm.get('phone')?.disable();
    } else {
      this.bookingForm.get('phone')?.enable();
    }

    if (data.phoneCode) {
      if (this.phoneCodes.length > 0) {
        const matchingCode = this.phoneCodes.find(c => c.phoneCode === data.phoneCode);
        if (matchingCode) {
          this.selectPhoneCode(matchingCode, true);
        } else {
          this.bookingForm.get('phoneCodeId')?.enable();
        }
        this.pendingFoundUserData = null;
      } else {
        this.pendingFoundUserData = data;
        this.bookingForm.get('phoneCodeId')?.enable();
      }
    } else {
      this.bookingForm.get('phoneCodeId')?.enable();
      this.pendingFoundUserData = null;
    }
  }

  onEmailBlur(): void {
    if (!this.isAdminOrDriver) return;

    const emailControl = this.bookingForm.get('email');
    if (!emailControl || emailControl.invalid) {
      return;
    }

    const email = emailControl.value?.trim().toLowerCase();
    if (!email) return;

    this.searchingUser = true;
    this.userSearched = false;

    this.apiService
      .get<{ success: boolean; data: { found: boolean; userId?: string; fullName?: string; phone?: string; phoneCode?: string } }>(
        `/user/search?email=${encodeURIComponent(email)}`
      )
      .subscribe({
        next: (response) => {
          this.searchingUser = false;
          this.userSearched = true;

          if (response.success && response.data.found) {
            this.foundUserId = response.data.userId || null;
            this.applyFoundUserData(response.data);
          } else {
            this.foundUserId = null;
            this.bookingForm.get('fullName')?.enable();
            this.bookingForm.get('phone')?.enable();
            this.bookingForm.get('phoneCodeId')?.enable();
          }
        },
        error: () => {
          this.searchingUser = false;
          this.userSearched = true;
          this.foundUserId = null;
          this.bookingForm.get('fullName')?.enable();
          this.bookingForm.get('phone')?.enable();
          this.bookingForm.get('phoneCodeId')?.enable();
        },
      });
  }

  private loadUserProfile(): void {
    this.profileLoading = true;
    this.apiService.get<{ success: boolean; data: UserProfile }>('/user/profile').subscribe({
      next: (response) => {
        if (response.success) {
          this.userProfile = response.data;
          this.fillUserProfileFields();
        }
        this.profileLoading = false;
      },
      error: () => {
        this.profileLoading = false;
      },
    });
  }

  private fillUserProfileFields(): void {
    if (!this.userProfile) return;

    const fullName = `${this.userProfile.name} ${this.userProfile.surname}`.trim();
    
    if (fullName) {
      this.bookingForm.patchValue({ fullName });
      this.bookingForm.get('fullName')?.disable();
    }
    
    if (this.userProfile.email) {
      this.bookingForm.patchValue({ email: this.userProfile.email });
      this.bookingForm.get('email')?.disable();
    }
    
    if (this.userProfile.phone) {
      this.bookingForm.patchValue({ phone: this.userProfile.phone });
      this.bookingForm.get('phone')?.disable();
    }

    if (this.userProfile.phoneCode && this.phoneCodes.length > 0) {
      const matchingCode = this.phoneCodes.find(c => c.phoneCode === this.userProfile!.phoneCode);
      if (matchingCode) {
        this.selectPhoneCode(matchingCode, true);
      }
    }
  }

  private loadUserCars(): void {
    this.carsLoading = true;
    this.apiService.get<{ success: boolean; data: Car[] }>('/cars').subscribe({
      next: (response) => {
        if (response.success) {
          this.cars = response.data;
          if (this.cars.length > 0) {
            if (this.isEditMode && this.existingBooking) {
              const matchingCar = this.cars.find(car => 
                car.plateNo === this.existingBooking!.plateNo
              );
              if (matchingCar) {
                this.selectCar(matchingCar);
              } else {
                this.selectCar(this.cars[0]);
              }
            } else {
              this.selectCar(this.cars[0]);
            }
          }
        }
        this.carsLoading = false;
      },
      error: () => {
        this.carsLoading = false;
      },
    });
  }

  selectCar(car: Car): void {
    this.selectedCar = car;
    this.bookingForm.patchValue({
      vehicleBrand: car.carBrand,
      vehicleModel: car.carModel,
      vehicleColor: car.carColor,
      licensePlate: car.plateNo,
    });

    this.bookingForm.get('vehicleBrand')?.disable();
    this.bookingForm.get('vehicleModel')?.disable();
    this.bookingForm.get('vehicleColor')?.disable();
    this.bookingForm.get('licensePlate')?.disable();
  }

  openAddCarModal(): void {
    this.carForm.reset();
    this.modalRef = this.modalService.open(this.addCarModal, {
      centered: true,
      backdrop: 'static',
    });
  }

  closeModal(): void {
    this.modalRef?.close();
    this.modalRef = null;
  }

  saveNewCar(): void {
    if (this.carForm.invalid) {
      Object.values(this.carForm.controls).forEach((control) => {
        control.markAsTouched();
      });
      return;
    }

    this.savingCar = true;
    const carData = this.carForm.value;

    this.apiService.post<{ success: boolean; data: Car }>('/cars', carData).subscribe({
      next: (response) => {
        if (response.success) {
          this.cars.push(response.data);
          this.selectCar(response.data);
          this.closeModal();
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Car added successfully',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
        this.savingCar = false;
      },
      error: (err) => {
        this.savingCar = false;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: err.error?.message || 'Failed to add car',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  hasCarFormError(fieldName: string): boolean {
    const control = this.carForm.get(fieldName);
    return control ? control.invalid && (control.dirty || control.touched) : false;
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
        
        if (this.existingBooking?.parkingTypeId) {
          this.bookingForm.patchValue({ parkingType: this.existingBooking.parkingTypeId });
        } else if (!this.isEditMode && response.parkingTypes.length > 0) {
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
        if (!this.isEditMode) {
          this.bookingForm.patchValue({ parkingType: 'parkingType_covered' });
        }
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
        
        if (this.existingBooking?.phoneCodeId) {
          const matchingCode = codes.find(c => c.id === this.existingBooking!.phoneCodeId);
          if (matchingCode) {
            this.selectPhoneCode(matchingCode, true);
          }
          return;
        }
        
        if (this.pendingFoundUserData?.phoneCode) {
          const matchingCode = codes.find(c => c.phoneCode === this.pendingFoundUserData!.phoneCode);
          if (matchingCode) {
            this.selectPhoneCode(matchingCode, true);
          }
          this.pendingFoundUserData = null;
          return;
        }
        
        if (this.userProfile?.phoneCode) {
          const matchingCode = codes.find(c => c.phoneCode === this.userProfile!.phoneCode);
          if (matchingCode) {
            this.selectPhoneCode(matchingCode, true);
            return;
          }
        }
        
        if (!this.isEditMode) {
          const cyprusCode = codes.find((c) => c.isoCode === 'CY');
          if (cyprusCode) {
            this.selectPhoneCode(cyprusCode);
          } else if (codes.length > 0) {
            this.selectPhoneCode(codes[0]);
          }
        }
      },
      error: () => {
        this.phoneCodes = [{ id: 'default', isoCode: 'CY', phoneCode: '+357' }];
        if (!this.isEditMode) {
          this.selectPhoneCode(this.phoneCodes[0]);
        }
      },
    });
  }

  selectPhoneCode(code: PhoneCode, disableAfter = false): void {
    this.selectedPhoneCode = code;
    this.bookingForm.patchValue({ phoneCodeId: code.id });
    if (disableAfter) {
      this.bookingForm.get('phoneCodeId')?.disable();
    }
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
    this.router.navigate(['/admin/bookings']);
  }

  get f() {
    return this.bookingForm.controls;
  }

  hasError(fieldName: string): boolean {
    const control = this.bookingForm.get(fieldName);
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  validateFlight(): void {
    const flightNumber = this.bookingForm.get('flightNumber')?.value?.trim();
    if (!flightNumber) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Please enter a flight number',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    this.flightValidating = true;
    this.flightService.validateFlightNumber(flightNumber).subscribe({
      next: (response) => {
        this.flightValidating = false;
        if (response.success) {
          this.flightValidated = true;
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Flight ${response.data?.flightNumber} verified (${response.data?.airline})`,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
      },
      error: (err) => {
        this.flightValidating = false;
        this.flightValidated = false;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: err.error?.error || 'Flight not found. Please check the flight number.',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  onFlightNumberChange(): void {
    this.flightValidated = false;
  }

  submitBooking(): void {
    if (this.bookingForm.invalid) {
      Object.keys(this.bookingForm.controls).forEach((key) => {
        this.bookingForm.get(key)?.markAsTouched();
      });
      return;
    }

    const flightNumber = this.bookingForm.get('flightNumber')?.value?.trim();
    if (flightNumber && !this.flightValidated) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Please validate the flight number before submitting',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
      });
      return;
    }

    this.submitting = true;

    const formValue = this.bookingForm.getRawValue();
    const booking: Record<string, unknown> = {
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
      dropOffOption: formValue.dropOffOption,
      checkOutDate: this.formatDateForApi(formValue.checkOutDate),
      checkOutTime: formValue.checkOutTime,
      pickUpOption: formValue.pickUpOption,
      parkingTypeId: formValue.parkingType,
      washService: this.washServiceEnabled,
    };

    if (this.isAdminOrDriver) {
      booking['userId'] = this.foundUserId;
    }

    if (this.isEditMode && this.bookingId) {
      this.apiService.put(`/bookings/${this.bookingId}`, booking).subscribe({
        next: () => {
          this.submitting = false;
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Booking updated successfully',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
          this.router.navigate(['/admin/bookings']);
        },
        error: (err) => {
          this.submitting = false;
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: err.error?.error || err.error?.message || 'Failed to update booking. Please try again.',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
          });
        },
      });
    } else {
      this.apiService.post('/bookings', booking).subscribe({
        next: () => {
          this.submitting = false;
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Booking created successfully',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
          this.router.navigate(['/admin/bookings']);
        },
        error: (err) => {
          this.submitting = false;
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: err.error?.message || 'Failed to create booking. Please try again.',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
          });
        },
      });
    }
  }

  saveParkedBooking(): void {
    if (!this.bookingId || !this.isBookingParked) return;

    this.submitting = true;
    const formValue = this.bookingForm.getRawValue();
    
    const updateData: { parkPlace: string; pickUpOption: string; washService?: boolean } = {
      parkPlace: this.parkPlace.trim(),
      pickUpOption: formValue.pickUpOption,
    };
    
    if (this.washAvailable) {
      updateData.washService = this.washServiceEnabled;
    }

    this.apiService.patch(`/bookings/${this.bookingId}/parked`, updateData).subscribe({
      next: () => {
        this.submitting = false;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Booking updated successfully',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
        this.router.navigate(['/admin/bookings']);
      },
      error: (err) => {
        this.submitting = false;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: err.error?.error || err.error?.message || 'Failed to update booking. Please try again.',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });
      },
    });
  }

  private formatDateForApi(date: NgbDateStruct): string {
    const year = date.year;
    const month = date.month.toString().padStart(2, '0');
    const day = date.day.toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}
