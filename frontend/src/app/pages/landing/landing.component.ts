import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  private router = inject(Router);
  private authService =
    environment.auth0Domain && environment.auth0ClientId
      ? inject(AuthService, { optional: true })
      : null;

  isAuth0Configured = !!(environment.auth0Domain && environment.auth0ClientId);

  proceedAsGuest(): void {
    this.router.navigate(['/guest/book']);
  }

  login(): void {
    if (this.authService) {
      this.authService.loginWithRedirect({
        appState: { target: '/admin/dashboard' },
      });
    } else {
      alert('Auth0 is not configured. Please add your Auth0 domain and client ID.');
    }
  }
}
