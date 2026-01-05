import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, ValidationErrors } from '@angular/forms';

@Component({
  selector: 'app-form-field-error',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-field-error.component.html',
  styleUrls: ['./form-field-error.component.scss']
})
export class FormFieldErrorComponent {
  @Input() control: AbstractControl | null = null;
  @Input() fieldName = 'This field';
  @Input() customMessages: { [key: string]: string } = {};

  get showError(): boolean {
    return this.control ? this.control.invalid && (this.control.dirty || this.control.touched) : false;
  }

  get errorMessage(): string {
    if (!this.control || !this.control.errors) return '';

    const errors: ValidationErrors = this.control.errors;

    if (this.customMessages) {
      for (const key of Object.keys(errors)) {
        if (this.customMessages[key]) {
          return this.customMessages[key];
        }
      }
    }

    if (errors['required']) {
      return `${this.fieldName} can not be empty, please enter required information`;
    }
    if (errors['email']) {
      return 'Please enter a valid email address';
    }
    if (errors['minlength']) {
      return `${this.fieldName} must be at least ${errors['minlength'].requiredLength} characters`;
    }
    if (errors['maxlength']) {
      return `${this.fieldName} must not exceed ${errors['maxlength'].requiredLength} characters`;
    }
    if (errors['pattern']) {
      return `${this.fieldName} format is invalid`;
    }
    if (errors['min']) {
      return `${this.fieldName} must be at least ${errors['min'].min}`;
    }
    if (errors['max']) {
      return `${this.fieldName} must not exceed ${errors['max'].max}`;
    }

    return `${this.fieldName} is invalid`;
  }
}
