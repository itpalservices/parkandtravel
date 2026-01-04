import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  proceedAsGuest(): void {
    this.router.navigate(['/guest/book']);
  }

  login(): void {
    this.authService.loginWithRedirect({
      appState: { target: '/bookings' }
    });
  }
}
