import { Component, inject, Injector } from '@angular/core';
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
  private injector = inject(Injector);

  isAuth0Configured = !!(environment.auth0.domain && environment.auth0.clientId);

  proceedAsGuest(): void {
    this.router.navigate(['/guest/book']);
  }

  login(): void {
    if (this.isAuth0Configured) {
      try {
        const authService = this.injector.get(AuthService);
        authService.loginWithRedirect({
          appState: { target: '/admin/dashboard' },
        });
      } catch {
        alert('Auth0 is not configured properly.');
      }
    } else {
      alert('Auth0 is not configured. Please add your Auth0 domain and client ID.');
    }
  }
}
