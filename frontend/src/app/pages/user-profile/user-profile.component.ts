import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { FormFieldErrorComponent } from '../../shared/components/form-field-error/form-field-error.component';
import { ApiService } from '../../core/services/api.service';
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

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbDropdownModule,
    FormFieldErrorComponent,
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);

  profileForm!: FormGroup;
  loading = true;
  saving = false;
  loadError = '';
  saveError = '';

  phoneCodes: PhoneCode[] = [];
  selectedPhoneCode: PhoneCode | null = null;
  phoneCodeSearch = '';
  private userPhoneCode = '';

  ngOnInit(): void {
    this.initForm();
    this.loadPhoneCodes();
    this.loadProfile();
  }

  private initForm(): void {
    this.profileForm = this.fb.group({
      email: [{ value: '', disabled: true }],
      name: ['', Validators.required],
      surname: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d*$/)]],
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

  get f() {
    return this.profileForm.controls;
  }

  hasError(field: string): boolean {
    const control = this.profileForm.get(field);
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
}
