import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  inject,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { NgbDropdownModule, NgbModalModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormFieldErrorComponent } from '../../shared/components/form-field-error/form-field-error.component';
import { ApiService } from '../../core/services/api.service';
import { UserProfileService } from '../../core/services/user-profile.service';
import { RoleService, UserRoleInfo } from '../../core/services/role.service';
import { SettingsService, ConfigurationSettings } from '../../core/services/settings.service';
import Swal from 'sweetalert2';
import { Car, UserProfile } from '../../shared/models/user-profile.model';
import { PhoneCode } from '../../shared/models/phone-codes.model';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbDropdownModule,
    NgbModalModule,
    FormFieldErrorComponent,
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit, OnDestroy, AfterViewChecked {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private userProfileService = inject(UserProfileService);
  private roleService = inject(RoleService);
  private modalService = inject(NgbModal);
  private settingsService = inject(SettingsService);

  profileForm!: FormGroup;
  carForm!: FormGroup;
  settingsForm!: FormGroup;
  loading = true;
  saving = false;
  loadError = '';
  saveError = '';

  isAdmin = false;
  settingsLoading = false;
  settingsError = '';
  settingsSaveError = '';
  savingSettings = false;
  offerWashService = false;
  settingsSubmitted = false;
  mandatoryPayment = false;
  mandatoryCheckInPayment = false;
  airportDelivery = true;
  availableAfter = 0;
  priceIncrementsCovered: number[] = [];
  priceIncrementsUncovered: number[] = [];
  newIncrementCovered: number | null = null;
  newIncrementUncovered: number | null = null;

  phoneCodes: PhoneCode[] = [];
  selectedPhoneCode: PhoneCode | null = null;
  phoneCodeSearch = '';
  private userPhoneCode = '';

  emailVerified = true;
  resendingVerification = false;
  resendCooldown = 0;
  private cooldownInterval: any = null;

  isRegularUser = false;
  cars: Car[] = [];
  carsLoading = false;
  carsError = '';
  savingCar = false;
  editingCar: Car | null = null;

  @ViewChild('profileSection') profileSection!: ElementRef<HTMLElement>;
  @ViewChild('carsSection') carsSection!: ElementRef<HTMLElement>;
  private lastProfileHeight = 0;

  ngOnInit(): void {
    this.initForm();
    this.initCarForm();
    this.initSettingsForm();
    this.loadPhoneCodes();
    this.loadProfile();
    this.checkUserRole();
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  ngAfterViewChecked(): void {
    this.syncSectionHeights();
  }

  private syncSectionHeights(): void {
    if (
      !this.isRegularUser ||
      !this.profileSection?.nativeElement ||
      !this.carsSection?.nativeElement
    ) {
      return;
    }

    const profileHeight = this.profileSection.nativeElement.offsetHeight;
    if (profileHeight > 0 && profileHeight !== this.lastProfileHeight) {
      this.lastProfileHeight = profileHeight;
      this.carsSection.nativeElement.style.maxHeight = `${profileHeight}px`;
    }
  }

  private initForm(): void {
    this.profileForm = this.fb.group({
      email: [{ value: '', disabled: true }],
      name: ['', Validators.required],
      surname: ['', Validators.required],
      phone: ['', [Validators.pattern(/^\d*$/)]],
    });
  }

  private initCarForm(): void {
    this.carForm = this.fb.group({
      carBrand: ['', Validators.required],
      carModel: ['', Validators.required],
      carColor: ['', Validators.required],
      plateNo: ['', Validators.required],
    });
  }

  private initSettingsForm(): void {
    this.settingsForm = this.fb.group({
      availableUncovered: [null, [Validators.min(1), Validators.pattern(/^\d*$/)]],
      availableCovered: [null, [Validators.min(1), Validators.pattern(/^\d*$/)]],
      priceUncovered: [null, [Validators.min(1)]],
      priceCovered: [null, [Validators.min(1)]],
      priceWash: [null, [Validators.min(1)]],
      dayEnd: [null, [Validators.min(0), Validators.pattern(/^\d*$/)]],
      availableAfter: [0, [Validators.min(0), Validators.pattern(/^\d*$/)]],
      deliveryFee: [null, [Validators.min(0)]],
      tax: [0, [Validators.min(0), Validators.max(100)]],
      emailDescription: [null],
      mandatoryPayment: [false],
      mandatoryCheckInPayment: [false]
    });

    this.settingsForm.get('availableUncovered')!.valueChanges.subscribe((value) => {
      const priceUncoveredCtrl = this.settingsForm.get('priceUncovered')!;

      if (value === null || value === 0) {
        priceUncoveredCtrl.reset({
          value: null,
          disabled: true,
        });
      } else {
        priceUncoveredCtrl.enable();
      }
    });

    this.settingsForm.get('availableCovered')!.valueChanges.subscribe((value) => {
      const priceCoveredCtrl = this.settingsForm.get('priceCovered')!;

      if (value === null || value === 0) {
        priceCoveredCtrl.reset({
          value: null,
          disabled: true,
        });
      } else {
        priceCoveredCtrl.enable();
      }
    });
  }

  loadSettings(): void {
    this.settingsLoading = true;
    this.settingsError = '';

    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.settingsForm.patchValue({
          availableUncovered: settings.availableUncovered,
          availableCovered: settings.availableCovered,
          priceUncovered: settings.priceUncovered?.toFixed(2),
          priceCovered: settings.priceCovered?.toFixed(2),
          priceWash: settings.priceWash?.toFixed(2),
          dayEnd: settings.dayEnd,
          availableAfter: settings.availableAfter ?? 0,
          deliveryFee: settings.deliveryFee?.toFixed(2),
          tax: settings.tax,
          emailDescription: settings.emailDescription,
          mandatoryPayment: settings.mandatoryPayment,
          mandatoryCheckInPayment: settings.mandatoryCheckInPayment
        });
        this.mandatoryPayment = settings.mandatoryPayment;
        this.mandatoryCheckInPayment = settings.mandatoryCheckInPayment;
        this.airportDelivery = settings.airportDelivery ?? true;
        this.offerWashService = settings.priceWash !== null;
        this.priceIncrementsCovered = settings.priceIncrementsCovered || [];
        this.priceIncrementsUncovered = settings.priceIncrementsUncovered || [];
        this.settingsLoading = false;
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        this.settingsError = 'Failed to load settings. Please try again.';
        this.settingsLoading = false;
      },
    });
  }

  get hasAvailabilityError(): boolean {
    const uncovered = this.settingsForm.get('availableUncovered')?.value;
    const covered = this.settingsForm.get('availableCovered')?.value;
    return (
      (uncovered === null || uncovered === '' || uncovered === undefined || uncovered === 0) &&
      (covered === null || covered === '' || covered === undefined || covered === 0)
    );
  }

  get canSetPriceUncovered(): boolean {
    const uncovered = this.settingsForm.get('availableUncovered')?.value;
    return (
      uncovered !== null && uncovered !== '' && uncovered !== undefined && Number(uncovered) >= 1
    );
  }

  get canSetPriceCovered(): boolean {
    const covered = this.settingsForm.get('availableCovered')?.value;
    return covered !== null && covered !== '' && covered !== undefined && Number(covered) >= 1;
  }

  get hasMissingPriceUncovered(): boolean {
    if (!this.canSetPriceUncovered) return false;
    const price = this.settingsForm.get('priceUncovered')?.value;
    return price === null || price === '' || price === undefined || Number(price) <= 0;
  }

  get hasMissingPriceCovered(): boolean {
    if (!this.canSetPriceCovered) return false;
    const price = this.settingsForm.get('priceCovered')?.value;
    return price === null || price === '' || price === undefined || Number(price) <= 0;
  }

  get hasMissingPriceWash(): boolean {
    if (!this.offerWashService) return false;
    const price = this.settingsForm.get('priceWash')?.value;
    return price === null || price === '' || price === undefined || Number(price) < 1;
  }

  toggleWashService(): void {
    this.offerWashService = !this.offerWashService;
    if (!this.offerWashService) {
      this.settingsForm.patchValue({ priceWash: null });
    }
  }

  saveSettings(): void {
    this.settingsSubmitted = true;
    this.settingsSaveError = '';

    this.settingsForm.get('availableUncovered')?.markAsTouched();
    this.settingsForm.get('availableCovered')?.markAsTouched();

    if (this.hasAvailabilityError) {
      return;
    }

    if (this.hasMissingPriceUncovered || this.hasMissingPriceCovered || this.hasMissingPriceWash) {
      return;
    }

    const formValue = this.settingsForm.getRawValue();

    if (!this.canSetPriceUncovered && formValue.priceUncovered) {
      this.settingsForm.patchValue({ priceUncovered: null });
    }
    if (!this.canSetPriceCovered && formValue.priceCovered) {
      this.settingsForm.patchValue({ priceCovered: null });
    }

    this.savingSettings = true;

    const data: Partial<ConfigurationSettings> = {
      availableUncovered:
        formValue.availableUncovered !== '' && formValue.availableUncovered !== null
          ? Number(formValue.availableUncovered)
          : null,
      availableCovered:
        formValue.availableCovered !== '' && formValue.availableCovered !== null
          ? Number(formValue.availableCovered)
          : null,
      priceUncovered:
        this.canSetPriceUncovered &&
        formValue.priceUncovered !== '' &&
        formValue.priceUncovered !== null
          ? Number(formValue.priceUncovered)
          : null,
      priceCovered:
        this.canSetPriceCovered && formValue.priceCovered !== '' && formValue.priceCovered !== null
          ? Number(formValue.priceCovered)
          : null,
      priceWash:
        this.offerWashService && formValue.priceWash !== '' && formValue.priceWash !== null
          ? Number(formValue.priceWash)
          : null,
      dayEnd:
        formValue.dayEnd !== '' && formValue.dayEnd !== null
          ? Number(formValue.dayEnd)
          : null,
      deliveryFee:
        formValue.deliveryFee !== '' && formValue.deliveryFee !== null
          ? Number(formValue.deliveryFee)
          : null,
      tax:
        formValue.tax !== '' && formValue.tax !== null
          ? Number(formValue.tax)
          :null,
      emailDescription:
        formValue.emailDescription !== '' && formValue.emailDescription !== null
          ? formValue.emailDescription
          : null,
      priceIncrementsCovered: this.priceIncrementsCovered.length > 0 ? this.priceIncrementsCovered : null,
      priceIncrementsUncovered: this.priceIncrementsUncovered.length > 0 ? this.priceIncrementsUncovered : null,
      mandatoryPayment: this.mandatoryPayment,
      mandatoryCheckInPayment: this.mandatoryCheckInPayment,
      airportDelivery: this.airportDelivery,
      availableAfter: formValue.availableAfter !== '' && formValue.availableAfter !== null
        ? Math.max(0, Math.floor(Number(formValue.availableAfter)))
        : 0
    };

    this.settingsService.updateSettings(data).subscribe({
      next: () => {
        this.savingSettings = false;
        this.settingsSubmitted = false;
        Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        }).fire({
          icon: 'success',
          title: 'Settings saved successfully',
        });
      },
      error: (error) => {
        console.error('Error saving settings:', error);
        this.savingSettings = false;
        this.settingsSaveError = error.error?.error || 'Failed to save settings. Please try again.';
      },
    });
  }

  get sf() {
    return this.settingsForm.controls;
  }

  addIncrement(type: 'covered' | 'uncovered'): void {
    const value = type === 'covered' ? this.newIncrementCovered : this.newIncrementUncovered;
    if (value !== null && value >= 0) {
      if (type === 'covered') {
        this.priceIncrementsCovered = [...this.priceIncrementsCovered, value];
        this.newIncrementCovered = null;
      } else {
        this.priceIncrementsUncovered = [...this.priceIncrementsUncovered, value];
        this.newIncrementUncovered = null;
      }
    }
  }

  removeIncrement(type: 'covered' | 'uncovered', index: number): void {
    if (type === 'covered') {
      this.priceIncrementsCovered = this.priceIncrementsCovered.filter((_, i) => i !== index);
    } else {
      this.priceIncrementsUncovered = this.priceIncrementsUncovered.filter((_, i) => i !== index);
    }
  }

  copyIncrementsToCovered(): void {
    this.priceIncrementsCovered = [...this.priceIncrementsUncovered];
  }

  copyIncrementsToUncovered(): void {
    this.priceIncrementsUncovered = [...this.priceIncrementsCovered];
  }

  updateIncrement(type: 'covered' | 'uncovered', index: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!isNaN(value) && value >= 0) {
      if (type === 'covered') {
        this.priceIncrementsCovered = this.priceIncrementsCovered.map((v, i) => i === index ? value : v);
      } else {
        this.priceIncrementsUncovered = this.priceIncrementsUncovered.map((v, i) => i === index ? value : v);
      }
    }
  }

  getProgressivePrice(type: 'covered' | 'uncovered', dayIndex: number): number {
    const baseKey = type === 'covered' ? 'priceCovered' : 'priceUncovered';
    const basePrice = Number(this.settingsForm.get(baseKey)?.value) || 0;
    const increments = type === 'covered' ? this.priceIncrementsCovered : this.priceIncrementsUncovered;
    let price = basePrice;
    for (let d = 0; d < dayIndex; d++) {
      const inc = increments.length > 0
        ? (d < increments.length ? increments[d] : increments[increments.length - 1])
        : 0;
      price += inc;
    }
    return price;
  }

  private checkUserRole(): void {
    this.roleService.getUserRole().subscribe({
      next: (roleInfo: UserRoleInfo) => {
        this.isRegularUser = roleInfo.isUser;
        this.isAdmin = roleInfo.isAdmin;
        if (this.isRegularUser) {
          this.loadCars();
        }
        if (this.isAdmin) {
          this.loadSettings();
        }
      },
    });
  }

  private loadPhoneCodes(): void {
    this.apiService.get<PhoneCode[]>('/phone-codes').subscribe({
      next: (codes) => {
        this.phoneCodes = codes;
        this.selectPhoneCodeFromUser();
      },
      error: () => {
        this.phoneCodes = [{ id: 'default', isoCode: 'CY', phoneCode: '+357' }];
        this.selectPhoneCodeFromUser();
      },
    });
  }

  private selectPhoneCodeFromUser(): void {
    if (this.userPhoneCode && this.phoneCodes.length > 0) {
      const userCode = this.phoneCodes.find((c) => c.phoneCode === this.userPhoneCode);
      if (userCode) {
        this.selectedPhoneCode = userCode;
        return;
      }
    }
    const cyprusCode = this.phoneCodes.find((c) => c.isoCode === 'CY');
    if (cyprusCode && !this.selectedPhoneCode) {
      this.selectedPhoneCode = cyprusCode;
    } else if (this.phoneCodes.length > 0 && !this.selectedPhoneCode) {
      this.selectedPhoneCode = this.phoneCodes[0];
    }
  }

  loadProfile(): void {
    this.loading = true;
    this.loadError = '';

    this.apiService.get<{ success: boolean; data: UserProfile }>('/user/profile').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.profileForm.patchValue({
            email: response.data.email,
            name: response.data.name,
            surname: response.data.surname,
            phone: response.data.phone,
          });
          this.userPhoneCode = response.data.phoneCode;
          this.emailVerified = response.data.emailVerified;
          this.selectPhoneCodeFromUser();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.loadError = 'Failed to load profile. Please try again.';
        this.loading = false;
      },
    });
  }

  loadCars(): void {
    this.carsLoading = true;
    this.carsError = '';

    this.apiService.get<{ success: boolean; data: Car[] }>('/cars').subscribe({
      next: (response) => {
        if (response.success) {
          this.cars = response.data;
        }
        this.carsLoading = false;
      },
      error: (error) => {
        console.error('Error loading cars:', error);
        this.carsError = 'Failed to load cars.';
        this.carsLoading = false;
      },
    });
  }

  get f() {
    return this.profileForm.controls;
  }

  get cf() {
    return this.carForm.controls;
  }

  hasError(field: string): boolean {
    const control = this.profileForm.get(field);
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  hasCarError(field: string): boolean {
    const control = this.carForm.get(field);
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  selectPhoneCode(code: PhoneCode): void {
    this.selectedPhoneCode = code;
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

  resendVerificationEmail(): void {
    if (this.resendCooldown > 0 || this.resendingVerification) {
      return;
    }

    this.resendingVerification = true;

    this.apiService
      .post<{ success: boolean; message: string }>('/user/resend-verification', {})
      .subscribe({
        next: (response) => {
          this.resendingVerification = false;
          if (response.success) {
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Verification email sent',
              text: 'Please check your inbox and spam folder.',
              showConfirmButton: false,
              timer: 4000,
              timerProgressBar: true,
            });
            this.startCooldown();
          }
        },
        error: (error) => {
          this.resendingVerification = false;
          console.error('Error sending verification email:', error);
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Failed to send verification email',
            text: 'Please try again later.',
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
          });
        },
      });
  }

  private startCooldown(): void {
    this.resendCooldown = 60;
    this.cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownInterval);
        this.cooldownInterval = null;
      }
    }, 1000);
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      Object.values(this.profileForm.controls).forEach((control) => {
        control.markAsTouched();
      });
      return;
    }

    this.saving = true;
    this.saveError = '';

    const formValue = this.profileForm.getRawValue();
    const updateData = {
      name: formValue.name,
      surname: formValue.surname,
      phone: formValue.phone,
      phoneCode: this.selectedPhoneCode?.phoneCode || '',
    };

    this.apiService
      .put<{ success: boolean; data: UserProfile }>('/user/profile', updateData)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.userProfileService.updateProfile({
              name: response.data.name,
              surname: response.data.surname,
              emailVerified: response.data.emailVerified,
            });
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Profile saved successfully',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
          }
          this.saving = false;
        },
        error: (error) => {
          console.error('Error saving profile:', error);
          this.saveError = 'Failed to save profile. Please try again.';
          this.saving = false;
        },
      });
  }

  openCarModal(content: any, car?: Car): void {
    this.editingCar = car || null;
    if (car) {
      this.carForm.patchValue({
        carBrand: car.carBrand,
        carModel: car.carModel,
        carColor: car.carColor,
        plateNo: car.plateNo,
      });
    } else {
      this.carForm.reset();
    }
    this.modalService.open(content, { centered: true, beforeDismiss: () => true });
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        activeElement.blur();
      }
    }, 0);
  }

  saveCar(modal: any): void {
    if (this.carForm.invalid) {
      Object.values(this.carForm.controls).forEach((control) => {
        control.markAsTouched();
      });
      return;
    }

    this.savingCar = true;
    const carData = this.carForm.value;

    if (this.editingCar) {
      this.apiService
        .put<{ success: boolean; data: Car }>(`/cars/${this.editingCar.id}`, carData)
        .subscribe({
          next: (response) => {
            if (response.success) {
              const index = this.cars.findIndex((c) => c.id === this.editingCar!.id);
              if (index !== -1) {
                this.cars[index] = response.data;
              }
              Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Car updated successfully',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
              });
              modal.close();
            }
            this.savingCar = false;
          },
          error: (error) => {
            console.error('Error updating car:', error);
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'error',
              title: 'Failed to update car',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
            this.savingCar = false;
          },
        });
    } else {
      this.apiService.post<{ success: boolean; data: Car }>('/cars', carData).subscribe({
        next: (response) => {
          if (response.success) {
            this.cars.unshift(response.data);
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Car added successfully',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
            modal.close();
          }
          this.savingCar = false;
        },
        error: (error) => {
          console.error('Error adding car:', error);
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Failed to add car',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
          this.savingCar = false;
        },
      });
    }
  }

  deleteCar(car: Car): void {
    Swal.fire({
      title: 'Delete Car?',
      text: `Are you sure you want to delete ${car.carBrand} ${car.carModel}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.delete<{ success: boolean }>(`/cars/${car.id}`).subscribe({
          next: (response) => {
            if (response.success) {
              this.cars = this.cars.filter((c) => c.id !== car.id);
              Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Car deleted successfully',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
              });
            }
          },
          error: (error) => {
            console.error('Error deleting car:', error);
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'error',
              title: 'Failed to delete car',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
          },
        });
      }
    });
  }
}
