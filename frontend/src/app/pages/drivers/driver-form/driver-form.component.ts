import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import { PhoneCode } from '../../../shared/models/phone-codes.model';
import { Driver } from '../../../shared/models/driver.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-driver-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgbDropdownModule],
  templateUrl: './driver-form.component.html',
  styleUrl: './driver-form.component.scss'
})
export class DriverFormComponent implements OnInit {
  form!: FormGroup;
  phoneCodes: PhoneCode[] = [];
  selectedPhoneCode: PhoneCode | null = null;
  phoneCodeSearch = '';
  submitting = false;
  loadingDriver = false;

  isEditMode = false;
  driverId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.driverId = this.route.snapshot.paramMap.get('userId');
    this.isEditMode = !!this.driverId;

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      surname: ['', [Validators.required, Validators.minLength(1)]],
      phone: ['', [Validators.required]],
      email: [{ value: '', disabled: this.isEditMode }, [Validators.required, Validators.email]],
    });

    this.loadPhoneCodes();
  }

  loadPhoneCodes(): void {
    this.api.get<PhoneCode[]>('/phone-codes').subscribe({
      next: (codes) => {
        this.phoneCodes = codes;
        if (!this.isEditMode) {
          const cyprus = codes.find(c => c.isoCode === 'CY');
          this.selectedPhoneCode = cyprus || codes[0] || null;
        } else {
          this.loadDriverData();
        }
      },
      error: () => {
        this.phoneCodes = [{ id: 'default', isoCode: 'CY', phoneCode: '+357' }];
        this.selectedPhoneCode = this.phoneCodes[0];
        if (this.isEditMode) this.loadDriverData();
      }
    });
  }

  loadDriverData(): void {
    if (!this.driverId) return;
    this.loadingDriver = true;

    this.api.get<{ success: boolean; data: Driver[] }>(`/user/drivers?page=0`).subscribe({
      next: (response) => {
        const driver = response.data.find(d => d.userId === this.driverId);
        if (driver) {
          this.prefillForm(driver);
        } else {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Driver not found' });
          this.router.navigate(['/admin/drivers']);
        }
        this.loadingDriver = false;
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load driver data' });
        this.loadingDriver = false;
        this.router.navigate(['/admin/drivers']);
      }
    });
  }

  prefillForm(driver: Driver): void {
    this.form.patchValue({
      name: driver.name,
      surname: driver.surname,
      phone: driver.phone,
      email: driver.email,
    });

    if (driver.phoneCode && this.phoneCodes.length) {
      const match = this.phoneCodes.find(c => c.phoneCode === driver.phoneCode);
      this.selectedPhoneCode = match || null;
    }
  }

  get filteredPhoneCodes(): PhoneCode[] {
    const search = this.phoneCodeSearch.toLowerCase().trim();
    if (!search) return this.phoneCodes;
    return this.phoneCodes.filter(
      c => c.isoCode.toLowerCase().includes(search) || c.phoneCode.includes(search)
    );
  }

  selectPhoneCode(code: PhoneCode): void {
    this.selectedPhoneCode = code;
    this.phoneCodeSearch = '';
  }

  getFlagUrl(isoCode: string): string {
    return `https://flagcdn.com/w40/${isoCode.toLowerCase()}.png`;
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getError(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return `${this.fieldLabel(field)} is required`;
    if (control.errors['email']) return 'Please enter a valid email address';
    if (control.errors['minlength']) return `${this.fieldLabel(field)} is too short`;
    return 'Invalid value';
  }

  private fieldLabel(field: string): string {
    const labels: Record<string, string> = { name: 'Name', surname: 'Surname', phone: 'Phone', email: 'Email' };
    return labels[field] || field;
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selectedPhoneCode) return;

    this.submitting = true;

    if (this.isEditMode) {
      const payload = {
        name: this.form.value.name.trim(),
        surname: this.form.value.surname.trim(),
        phone: this.form.value.phone.trim(),
        phoneCode: this.selectedPhoneCode.phoneCode,
      };

      this.api.put<{ success: boolean }>(`/user/drivers/${this.driverId}`, payload).subscribe({
        next: () => {
          this.submitting = false;
          Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Driver updated successfully',
            showConfirmButton: false, timer: 3000, timerProgressBar: true,
          });
          this.router.navigate(['/admin/drivers']);
        },
        error: (err) => {
          this.submitting = false;
          Swal.fire({ icon: 'error', title: 'Error', text: err.error?.error || 'Failed to update driver. Please try again.' });
        }
      });
    } else {
      const payload = {
        name: this.form.value.name.trim(),
        surname: this.form.value.surname.trim(),
        email: this.form.value.email.trim().toLowerCase(),
        phone: this.form.value.phone.trim(),
        phoneCode: this.selectedPhoneCode.phoneCode,
      };

      this.api.post<{ success: boolean }>('/user/drivers', payload).subscribe({
        next: () => {
          this.submitting = false;
          Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Driver created successfully. A password reset email has been sent.',
            showConfirmButton: false, timer: 4000, timerProgressBar: true,
          });
          this.router.navigate(['/admin/drivers']);
        },
        error: (err) => {
          this.submitting = false;
          const message = err.error?.error || 'Failed to create driver. Please try again.';
          Swal.fire({ icon: 'error', title: 'Error', text: message });
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/admin/drivers']);
  }
}
