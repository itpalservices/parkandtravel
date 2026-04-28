import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-payment-failed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-failed.component.html',
  styleUrls: ['./payment-failed.component.scss'],
})
export class PaymentFailedComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ref: string | null = null;
  isAuthSource = false;

  ngOnInit(): void {
    this.ref = this.route.snapshot.queryParamMap.get('ref');
    const source = this.route.snapshot.queryParamMap.get('source');
    this.isAuthSource = source === 'auth';

    if (source === 'auth_pending') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Payment failed. Your booking was not created.',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true,
      });
      this.router.navigate(['/admin/bookings']);
      return;
    }

    if (this.isAuthSource) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Booking saved but payment was not completed.',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true,
      });
      this.router.navigate(['/admin/bookings']);
    }
  }

  tryAgain(): void {
    this.router.navigate(['/guest/book']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
