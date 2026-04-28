import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import Swal from 'sweetalert2';

interface VerifyResult {
  status: 'success' | 'failed' | 'pending';
  bookingId?: string;
  message?: string;
}

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-success.component.html',
  styleUrls: ['./payment-success.component.scss'],
})
export class PaymentSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);

  verifying = true;
  status: 'success' | 'failed' | 'pending' | null = null;
  message = '';
  bookingId: string | null = null;

  ngOnInit(): void {
    const ref = this.route.snapshot.queryParamMap.get('ref');
    const source = this.route.snapshot.queryParamMap.get('source');

    if (!ref) {
      if (source === 'auth') {
        this.redirectAuthWithToast('error', 'Invalid payment reference. Please contact support.');
      } else {
        this.verifying = false;
        this.status = 'failed';
        this.message = 'Invalid payment reference. Please contact support.';
      }
      return;
    }

    this.apiService.get<VerifyResult>(`/payment/verify?ref=${encodeURIComponent(ref)}`).subscribe({
      next: (result) => {
        this.verifying = false;
        this.status = result.status;
        this.message = result.message || '';
        this.bookingId = result.bookingId || null;

        if (source === 'auth_pending') {
          if (result.status === 'success') {
            this.redirectAuthWithToast('success', 'Payment completed! Your booking has been created.');
          } else if (result.status === 'failed') {
            this.redirectAuthWithToast('error', 'Payment failed. Your booking was not created.');
          } else {
            this.redirectAuthWithToast('info', 'Payment is still processing. Your booking will be created once confirmed.');
          }
        } else if (source === 'auth') {
          if (result.status === 'success') {
            this.redirectAuthWithToast('success', 'Payment completed successfully!');
          } else if (result.status === 'failed') {
            this.redirectAuthWithToast('warning', 'Booking saved but payment was not completed.');
          } else {
            this.redirectAuthWithToast('info', 'Payment is still processing. Check your booking for updates.');
          }
        }
      },
      error: (err) => {
        this.verifying = false;
        this.status = 'failed';
        this.message = err.error?.message || 'An error occurred while verifying your payment.';

        if (source === 'auth_pending') {
          this.redirectAuthWithToast('error', 'Payment could not be verified. Your booking was not created.');
        } else if (source === 'auth') {
          this.redirectAuthWithToast('warning', 'Booking saved but payment could not be verified.');
        }
      },
    });
  }

  private redirectAuthWithToast(icon: 'success' | 'warning' | 'error' | 'info', title: string): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
    });
    this.router.navigate(['/admin/bookings']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  tryAgain(): void {
    this.router.navigate(['/guest/book']);
  }
}
