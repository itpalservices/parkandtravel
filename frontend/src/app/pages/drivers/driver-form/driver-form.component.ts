import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import { PhoneCode } from '../../../shared/models/phone-codes.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-driver-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, NgbDropdownModule],
  templateUrl: './driver-form.component.html',
  styleUrl: './driver-form.component.scss'
})
export class DriverFormComponent implements OnInit {
  form!: FormGroup;
  phoneCodes: PhoneCode[] = [];
  selectedPhoneCode: PhoneCode | null = null;
  phoneCodeSearch = '';
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      surname: ['', [Validators.required, Validators.minLength(1)]],
      phone: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
    });

    this.loadPhoneCodes();
  }

  loadPhoneCodes(): void {
    this.api.get<PhoneCode[]>('/phone-codes').subscribe({
      next: (codes) => {
        this.phoneCodes = codes;
        const cyprus = codes.find(c => c.isoCode === 'CY');
        this.selectedPhoneCode = cyprus || codes[0] || null;
      },
      error: () => {
        this.phoneCodes = [{ id: 'default', isoCode: 'CY', phoneCode: '+357' }];
        this.selectedPhoneCode = this.phoneCodes[0];
      }
    });
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
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Driver created successfully. A password reset email has been sent.',
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
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

  onCancel(): void {
    this.router.navigate(['/admin/drivers']);
  }
}
