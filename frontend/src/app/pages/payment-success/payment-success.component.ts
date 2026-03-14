import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

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
    if (!ref) {
      this.verifying = false;
      this.status = 'failed';
      this.message = 'Invalid payment reference. Please contact support.';
      return;
    }
    this.apiService.get<VerifyResult>(`/payment/verify?ref=${encodeURIComponent(ref)}`).subscribe({
      next: (result) => {
        this.verifying = false;
        this.status = result.status;
        this.message = result.message || '';
        this.bookingId = result.bookingId || null;
      },
      error: (err) => {
        this.verifying = false;
        this.status = 'failed';
        this.message = err.error?.message || 'An error occurred while verifying your payment.';
      },
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  tryAgain(): void {
    this.router.navigate(['/guest/book']);
  }
}
