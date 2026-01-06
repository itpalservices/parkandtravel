import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { filter, take } from 'rxjs/operators';
import { RoleService } from '../../core/services/role.service';

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

  isAuth0Configured = !!(environment.auth0.domain && environment.auth0.clientId);
  isLoading = true;

  ngOnInit(): void {
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

  proceedAsGuest(): void {
    this.router.navigate(['/guest/book']);
  }

  login(): void {
    this.authService.loginWithRedirect({
      appState: { target: '/admin' },
    });
  }
}
