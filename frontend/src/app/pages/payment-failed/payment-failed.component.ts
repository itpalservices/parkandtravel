import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

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

  ngOnInit(): void {
    this.ref = this.route.snapshot.queryParamMap.get('ref');
  }

  tryAgain(): void {
    this.router.navigate(['/guest/book']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
