import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldErrorComponent } from '../../shared/components/form-field-error/form-field-error.component';
import { ApiService } from '../../core/services/api.service';
import Swal from 'sweetalert2';

interface UserProfile {
  email: string;
  name: string;
  surname: string;
  phone: string;
  emailVerified: boolean;
  picture?: string;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormFieldErrorComponent],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);

  profileForm!: FormGroup;
  loading = true;
  saving = false;
  loadError = '';
  saveError = '';

  ngOnInit(): void {
    this.initForm();
    this.loadProfile();
  }

  private initForm(): void {
    this.profileForm = this.fb.group({
      email: [{ value: '', disabled: true }],
      name: ['', Validators.required],
      surname: ['', Validators.required],
      phone: ['', [Validators.pattern(/^\d+$/)]]
    });
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
            phone: response.data.phone
          });
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.loadError = 'Failed to load profile. Please try again.';
        this.loading = false;
      }
    });
  }

  get f() {
    return this.profileForm.controls;
  }

  hasError(field: string): boolean {
    const control = this.profileForm.get(field);
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      Object.values(this.profileForm.controls).forEach(control => {
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
      phone: formValue.phone
    };

    this.apiService.put<{ success: boolean; data: UserProfile }>('/user/profile', updateData).subscribe({
      next: (response) => {
        if (response.success) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Profile saved successfully',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
          });
        }
        this.saving = false;
      },
      error: (error) => {
        console.error('Error saving profile:', error);
        this.saveError = 'Failed to save profile. Please try again.';
        this.saving = false;
      }
    });
  }
}
