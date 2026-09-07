import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { filter, take } from 'rxjs/operators';
import { RoleService } from '../../core/services/role.service';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private roleService = inject(RoleService);
  private settingsService = inject(SettingsService);

  isAuth0Configured = !!(environment.auth0.domain && environment.auth0.clientId);
  isLoading = true;
  // Fail-open: keep the guest option visible unless the backend explicitly says otherwise.
  showGuestForm = true;

  ngOnInit(): void {
    this.loadGuestFormSetting();

    if (!this.isAuth0Configured) {
      this.isLoading = false;
      return;
    }

    this.authService.isLoading$.pipe(
      filter(loading => !loading),
      take(1)
    ).subscribe(() => {
      this.authService.isAuthenticated$.pipe(take(1)).subscribe(isAuthenticated => {
        if (isAuthenticated) {
          this.roleService.getUserRole().pipe(take(1)).subscribe(roleInfo => {
            if (roleInfo.isAdmin) {
              this.router.navigate(['/admin/dashboard']);
            } else {
              this.router.navigate(['/admin/bookings']);
            }
          });
        } else {
          this.isLoading = false;
        }
      });
    });
  }

  private loadGuestFormSetting(): void {
    this.settingsService.getPublicSettings().pipe(take(1)).subscribe({
      next: (settings) => {
        this.showGuestForm = settings.showGuestForm;
      },
      error: (error) => {
        console.error('Error loading public settings:', error);
        // Keep the fail-open default (showGuestForm = true) on error.
      },
    });
  }

  proceedAsGuest(): void {
    this.router.navigate(['/guest/book']);
  }

  login(): void {
    this.authService.loginWithRedirect({
      appState: { target: '/admin' },
    });
  }
}
