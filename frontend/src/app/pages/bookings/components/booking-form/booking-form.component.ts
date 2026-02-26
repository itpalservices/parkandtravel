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
import { BookingsService } from '../../../../core/services/bookings.service';
import { FormFieldErrorComponent } from '../../../../shared/components/form-field-error/form-field-error.component';
import { Subscription, take } from 'rxjs';
import { BookingDetails, ParkingType, ParkingTypesResponse } from '../../../../shared';
import { PhoneCode } from '../../../../shared/models/phone-codes.model';
import { RoleService, UserRoleInfo } from '../../../../core/services/role.service';
import { UserProfile, Car } from '../../../../shared/models/user-profile.model';
import Swal from 'sweetalert2';
import { AuthService } from '@auth0/auth0-angular';
import { FormAction } from '../../../../shared/enums/form-action.enum';
import {
  AvailabilityService,
  AvailabilityResult,
} from '../../../../core/services/availability.service';
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';

interface UserSearchResponse {
  success: boolean;
  data: {
    found: boolean;
    userId?: string;
    email?: string;
    fullName?: string;
    phone?: string;
    phoneCode?: string;
  };
}

enum FormType {
  NewBooking,
  ExistingBooking,
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
    ImageCarouselComponent,
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
  returnDetailsEnabled = false;

  minDate: NgbDateStruct;
  checkOutMinDate: NgbDateStruct;

  submitting = false;
  private availabilityService = inject(AvailabilityService);
  private availabilitySubscription?: Subscription;

  checkingAvailability = false;
  availabilityResult: AvailabilityResult | null = null;
  availabilityError = '';

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
  bookingImages: string[] = [];
  showCarousel = false;
  carouselStartIndex = 0;

  private bookingsService = inject(BookingsService);

  constructor(
    private authService: AuthService,
    private _activatedRoute: ActivatedRoute,
  ) {
    const [{ path }] = this._activatedRoute.snapshot.url;

    this.formType = path === FormAction.Add ? FormType.NewBooking : FormType.ExistingBooking;

    if (this.formType === FormType.ExistingBooking) {
      this.bookingId = this._activatedRoute.snapshot.paramMap.get('id');
    }

    this.authService.user$.pipe(take(1)).subscribe((user) => {
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
            },
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
      checkOutDate: [defaultCheckOut],
      checkOutTime: ['10:00'],
      pickUpOption: ['self_pickup'],
      parkingType: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.roleService
      .getUserRole()
      .pipe(take(1))
      .subscribe((roleInfo) => {
        if (roleInfo.isDriver && !this.isEditMode) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'Drivers cannot create bookings',
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
        this.checkUserRole();
        this.checkAvailability();
        this.loadBookingImages();
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
    const checkOutDate = booking.dateTo ? this.parseApiDate(booking.dateTo) : null;
    const checkInTime = booking.timeFrom ? booking.timeFrom.substring(0, 5) : '10:00';
    const checkOutTime = booking.timeTo ? booking.timeTo.substring(0, 5) : '10:00';

    const hasReturnDetails = !!(booking.dateTo || booking.returnFlight || booking.pickUpOption);
    this.returnDetailsEnabled = hasReturnDetails;

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
      checkOutTime: checkOutTime || '10:00',
      pickUpOption: booking.pickUpOption || 'self_pickup',
      parkingType: booking.parkingTypeId || '',
    });

    if (hasReturnDetails) {
      this.bookingForm.get('flightNumber')?.setValidators([Validators.required]);
      this.bookingForm.get('checkOutDate')?.setValidators([Validators.required]);
      this.bookingForm.get('checkOutTime')?.setValidators([Validators.required]);
      this.bookingForm.get('pickUpOption')?.setValidators([Validators.required]);
      ['flightNumber', 'checkOutDate', 'checkOutTime', 'pickUpOption'].forEach((field) => {
        this.bookingForm.get(field)?.updateValueAndValidity();
      });
    }

    if (checkInDate) {
      const checkInNgbDate = new NgbDate(checkInDate.year, checkInDate.month, checkInDate.day);
      this.checkOutMinDate = this.calendar.getNext(checkInNgbDate, 'd', 1);
    }

    this.washServiceEnabled = booking.washService;

    if (booking.phoneCodeId && this.phoneCodes.length > 0) {
      const matchingCode = this.phoneCodes.find((c) => c.id === booking.phoneCodeId);
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
    const fieldsToKeepEnabled = ['pickUpOption', 'checkOutDate', 'checkOutTime', 'flightNumber'];

    allFormFields.forEach((field) => {
      if (!fieldsToKeepEnabled.includes(field)) {
        this.bookingForm.get(field)?.disable();
      } else {
        this.bookingForm.get(field)?.enable();
      }
    });
  }

  canToggleWashService(): boolean {
    return (
      this.washAvailable && (!this.isBookingParked || (this.isBookingParked && this.washAvailable))
    );
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
      returnFields.forEach((field) => {
        this.bookingForm.get(field)?.clearValidators();
      });
    }
    returnFields.forEach((field) => {
      this.bookingForm.get(field)?.updateValueAndValidity();
    });
  }

  private enableFieldsForNonParkedBooking(): void {
    const fieldsAlwaysDisabled = ['fullName', 'email', 'phone', 'phoneCodeId'];
    const allFormFields = Object.keys(this.bookingForm.controls);

    allFormFields.forEach((field) => {
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
      this.showParkPlaceAndImagesModal(newStatusId, newStatusLabel);
    } else if (newStatusId === 'bookingStatus_completed') {
      this.handleCompletedStatus(newStatusId, newStatusLabel);
    } else {
      this.performStatusUpdate(newStatusId, newStatusLabel);
    }
  }

  private showParkPlaceAndImagesModal(newStatusId: string, newStatusLabel: string): void {
    const modalSelectedFiles: File[] = [];
    const currentPlateNo = this.bookingForm?.get('licensePlate')?.value || '';
    const currentCarModel = this.bookingForm?.get('vehicleModel')?.value || '';
    const currentAdults =
      this.bookingForm?.get('adults')?.value || (this.existingBooking as any)?.adults || 1;

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
              <input id="swal-plate-no" class="swal2-input" placeholder="Plate number" value="${currentPlateNo}" style="margin: 0; width: 100%; box-sizing: border-box;" />
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Car Model</label>
              <input id="swal-car-model" class="swal2-input" placeholder="Car model" value="${currentCarModel}" style="margin: 0; width: 100%; box-sizing: border-box;" />
            </div>
          </div>
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #374151; font-size: 14px;">Adults <span style="color: #dc3545;">*</span></label>
              <input id="swal-adults" class="swal2-input" type="number" min="1" max="20" value="${currentAdults}" style="margin: 0; width: 100%; box-sizing: border-box;" />
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
            this.handleImageFiles(
              Array.from(fileInput.files),
              modalSelectedFiles,
              previewContainer,
            );
            fileInput.value = '';
          }
        });
      },
      preConfirm: () => {
        const parkPlace = (
          document.getElementById('swal-park-place') as HTMLInputElement
        ).value.trim();
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
        const mileageStr = (
          document.getElementById('swal-mileage') as HTMLInputElement
        ).value.trim();
        const mileageKm = mileageStr ? parseInt(mileageStr, 10) : undefined;
        const plateNo =
          (document.getElementById('swal-plate-no') as HTMLInputElement).value.trim() || undefined;
        const carModel =
          (document.getElementById('swal-car-model') as HTMLInputElement).value.trim() || undefined;
        const keepKeys = (document.getElementById('swal-keep-keys') as HTMLInputElement).checked;
        const parkingComments =
          (document.getElementById('swal-comments') as HTMLTextAreaElement).value.trim() ||
          undefined;
        return {
          parkPlace,
          mileageKm,
          plateNo,
          carModel,
          adults,
          keepKeys,
          parkingComments,
          files: [...modalSelectedFiles],
        };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const { parkPlace, files, ...extraFields } = result.value;
        this.performStatusUpdate(newStatusId, newStatusLabel, parkPlace, undefined, extraFields);
        if (files.length > 0 && this.bookingId) {
          this.uploadBookingImages(this.bookingId, files);
        }
      }
    });
  }

  openCarousel(index: number): void {
    this.carouselStartIndex = index;
    this.showCarousel = true;
  }

  closeCarousel(): void {
    this.showCarousel = false;
  }

  private loadBookingImages(): void {
    if (!this.bookingId) return;
    this.bookingsService.getBookingImages(this.bookingId).subscribe({
      next: (response) => {
        if (response.success) {
          this.bookingImages = response.data.urls;
        }
      },
      error: (error) => {
        console.error('Error loading booking images:', error);
      },
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
          this.loadBookingImages();
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

  private performStatusUpdate(
    newStatusId: string,
    newStatusLabel: string,
    parkPlace?: string,
    applyExtraFee?: boolean,
    extraFields?: {
      keepKeys?: boolean;
      mileageKm?: number;
      parkingComments?: string;
      plateNo?: string;
      carModel?: string;
      adults?: number;
    },
  ): void {
    if (!this.bookingId) return;

    this.updatingStatus = true;
    const body: Record<string, any> = {
      bookingStatusId: newStatusId,
    };
    if (parkPlace) body['parkPlace'] = parkPlace;
    if (applyExtraFee !== undefined) body['applyExtraFee'] = applyExtraFee;
    if (extraFields) Object.assign(body, extraFields);

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
          if (this.isEditMode && this.foundUserId) {
            this.loadFoundUserCars(this.existingBooking?.plateNo || undefined);
          }
        }
      },
    });
  }

  private initAdminDriverForm(): void {
    this.bookingForm.get('fullName')?.disable();
  }

  private applyFoundUserData(
    data: {
      email?: string;
      fullName?: string;
      phone?: string;
      phoneCode?: string;
    },
    source: 'email' | 'phone' = 'email',
  ): void {
    if (source === 'phone' && data.email) {
      this.bookingForm.patchValue({ email: data.email });
      this.bookingForm.get('email')?.disable();
    }

    if (data.fullName) {
      this.bookingForm.patchValue({ fullName: data.fullName });
      this.bookingForm.get('fullName')?.disable();
    } else {
      this.bookingForm.get('fullName')?.enable();
    }

    if (source === 'email') {
      if (data.phone) {
        this.bookingForm.patchValue({ phone: data.phone });
        this.bookingForm.get('phone')?.disable();
      } else {
        this.bookingForm.get('phone')?.enable();
      }
    }

    if (data.phoneCode) {
      if (this.phoneCodes.length > 0) {
        const matchingCode = this.phoneCodes.find((c) => c.phoneCode === data.phoneCode);
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

    if (this.foundUserId) {
      this.loadFoundUserCars();
    }
  }

  onEmailBlur(): void {
    if (!this.isAdminOrDriver) return;

    const emailControl = this.bookingForm.get('email');
    const email = emailControl?.value?.trim().toLowerCase();

    if (!email) {
      this.resetAdminSearch();
      return;
    }

    if (!emailControl || emailControl.invalid) {
      return;
    }

    this.searchingUser = true;
    this.userSearched = false;

    this.apiService
      .get<UserSearchResponse>(`/user/search?email=${encodeURIComponent(email)}`)
      .subscribe({
        next: (response) => {
          this.searchingUser = false;
          this.userSearched = true;

          if (response.success && response.data.found) {
            this.foundUserId = response.data.userId || null;
            this.applyFoundUserData(response.data, 'email');
          } else {
            this.clearFoundUser();
          }
        },
        error: () => {
          this.searchingUser = false;
          this.userSearched = true;
          this.clearFoundUser();
        },
      });
  }

  onPhoneBlur(): void {
    if (!this.isAdminOrDriver) return;

    const phoneControl = this.bookingForm.get('phone');
    const phone = phoneControl?.value?.trim();

    if (!phone) {
      this.resetAdminSearch();
      return;
    }

    if (this.foundUserId) return;

    if (!this.selectedPhoneCode) return;

    this.searchingUser = true;
    this.userSearched = false;

    const params = `phone=${encodeURIComponent(phone)}&phoneCode=${encodeURIComponent(this.selectedPhoneCode.phoneCode)}`;
    this.apiService.get<UserSearchResponse>(`/user/search?${params}`).subscribe({
      next: (response) => {
        this.searchingUser = false;
        this.userSearched = true;

        if (response.success && response.data.found) {
          this.foundUserId = response.data.userId || null;
          this.applyFoundUserData(response.data, 'phone');
        } else {
          this.clearFoundUser('phone');
        }
      },
      error: () => {
        this.searchingUser = false;
        this.userSearched = true;
        this.clearFoundUser('phone');
      },
    });
  }

  private resetAdminSearch(): void {
    this.foundUserId = null;
    this.cars = [];
    this.selectedCar = null;
    this.searchingUser = false;
    this.userSearched = false;
    this.bookingForm.get('email')?.enable();
    this.bookingForm.get('email')?.reset();
    this.bookingForm.get('phone')?.enable();
    this.bookingForm.get('phone')?.reset();
    this.bookingForm.get('phoneCodeId')?.enable();
    this.bookingForm.get('fullName')?.enable();
    this.bookingForm.get('fullName')?.reset();
    this.enableVehicleFields();
  }

  private clearFoundUser(source: 'email' | 'phone' = 'email'): void {
    this.foundUserId = null;
    this.cars = [];
    this.selectedCar = null;
    this.bookingForm.get('fullName')?.enable();
    if (source === 'email') {
      this.bookingForm.get('phone')?.enable();
      this.bookingForm.get('phoneCodeId')?.enable();
    }
    this.enableVehicleFields();
  }

  private enableVehicleFields(): void {
    this.bookingForm.get('vehicleBrand')?.enable();
    this.bookingForm.get('vehicleModel')?.enable();
    this.bookingForm.get('vehicleColor')?.enable();
    this.bookingForm.get('licensePlate')?.enable();
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
      const matchingCode = this.phoneCodes.find((c) => c.phoneCode === this.userProfile!.phoneCode);
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
              const matchingCar = this.cars.find(
                (car) => car.plateNo === this.existingBooking!.plateNo,
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

  private loadFoundUserCars(matchPlateNo?: string): void {
    if (!this.foundUserId) return;
    this.carsLoading = true;
    this.apiService
      .get<{
        success: boolean;
        data: Car[];
      }>(`/cars?userId=${encodeURIComponent(this.foundUserId)}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.cars = response.data;
            if (this.cars.length > 0) {
              const matchingCar = matchPlateNo
                ? this.cars.find((car) => car.plateNo === matchPlateNo)
                : null;
              this.selectCar(matchingCar || this.cars[0]);
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
    const carData = { ...this.carForm.value };
    if (this.isAdminOrDriver && this.foundUserId) {
      carData.userId = this.foundUserId;
    }

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

    const excludeBookingId = this.isEditMode && this.bookingId ? this.bookingId : undefined;

    this.availabilitySubscription = this.availabilityService
      .checkAvailability(dateFrom, dateTo, parkingType, excludeBookingId)
      .subscribe({
        next: (result) => {
          this.checkingAvailability = false;
          this.availabilityResult = result;
          if (!result.available) {
            this.availabilityError =
              result.message || 'No parking spots available for the selected dates';
          }
        },
        error: () => {
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

        if (this.existingBooking?.parkingTypeId) {
          this.bookingForm.patchValue({ parkingType: this.existingBooking.parkingTypeId });
        } else if (!this.isEditMode && response.parkingTypes.length > 0) {
          this.bookingForm.patchValue({ parkingType: response.parkingTypes[0].id });
          this.checkAvailability();
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
          this.checkAvailability();
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
    if (!this.returnDetailsEnabled) return 0;
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
          const matchingCode = codes.find((c) => c.id === this.existingBooking!.phoneCodeId);
          if (matchingCode) {
            this.selectPhoneCode(matchingCode, true);
          }
          return;
        }

        if (this.pendingFoundUserData?.phoneCode) {
          const matchingCode = codes.find(
            (c) => c.phoneCode === this.pendingFoundUserData!.phoneCode,
          );
          if (matchingCode) {
            this.selectPhoneCode(matchingCode, true);
          }
          this.pendingFoundUserData = null;
          return;
        }

        if (this.userProfile?.phoneCode) {
          const matchingCode = codes.find((c) => c.phoneCode === this.userProfile!.phoneCode);
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
      checkInDate: this.formatDateForApi(formValue.checkInDate),
      checkInTime: formValue.checkInTime,
      dropOffOption: formValue.dropOffOption,
      parkingTypeId: formValue.parkingType,
      washService: this.washServiceEnabled,
      flightNumber: this.returnDetailsEnabled ? formValue.flightNumber?.trim() || null : null,
      checkOutDate:
        this.returnDetailsEnabled && formValue.checkOutDate
          ? this.formatDateForApi(formValue.checkOutDate)
          : null,
      checkOutTime: this.returnDetailsEnabled ? formValue.checkOutTime : null,
      pickUpOption: this.returnDetailsEnabled ? formValue.pickUpOption : null,
      finalPrice: this.returnDetailsEnabled ? this.calculateTotalPrice() : null,
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
            title:
              err.error?.error ||
              err.error?.message ||
              'Failed to update booking. Please try again.',
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

    const updateData: Record<string, any> = {
      parkPlace: this.parkPlace.trim(),
      pickUpOption: this.returnDetailsEnabled ? formValue.pickUpOption : null,
      flightNumber: this.returnDetailsEnabled ? formValue.flightNumber?.trim() || null : null,
      checkOutDate:
        this.returnDetailsEnabled && formValue.checkOutDate
          ? this.formatDateForApi(formValue.checkOutDate)
          : null,
      checkOutTime: this.returnDetailsEnabled ? formValue.checkOutTime : null,
      washService: this.washServiceEnabled,
      finalPrice: this.returnDetailsEnabled ? this.calculateTotalPrice() : null,
    };

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
          title:
            err.error?.error || err.error?.message || 'Failed to update booking. Please try again.',
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
