import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
import Swal from 'sweetalert2';

interface UserProfile {
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
  emailVerified: boolean;
  picture?: string;
}

interface PhoneCode {
  id: string;
  isoCode: string;
  phoneCode: string;
}

interface Car {
  id: string;
  userId: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  plateNo: string;
  createdAt: Date;
  updatedAt: Date;
}

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
export class UserProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private userProfileService = inject(UserProfileService);
  private roleService = inject(RoleService);
  private modalService = inject(NgbModal);

  profileForm!: FormGroup;
  carForm!: FormGroup;
  loading = true;
  saving = false;
  loadError = '';
  saveError = '';

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

  ngOnInit(): void {
    this.initForm();
    this.initCarForm();
    this.loadPhoneCodes();
    this.loadProfile();
    this.checkUserRole();
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
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

  private checkUserRole(): void {
    this.roleService.getUserRole().subscribe({
      next: (roleInfo: UserRoleInfo) => {
        this.isRegularUser = roleInfo.isUser;
        if (this.isRegularUser) {
          this.loadCars();
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

    this.apiService.post<{ success: boolean; message: string }>('/user/resend-verification', {}).subscribe({
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
    this.modalService.open(content, { centered: true });
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
      this.apiService
        .post<{ success: boolean; data: Car }>('/cars', carData)
        .subscribe({
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
