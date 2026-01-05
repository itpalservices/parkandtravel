import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, filter, take } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private destroyRef = inject(DestroyRef);

  isAuth0Configured = !!(environment.auth0.domain && environment.auth0.clientId);
  isLoading = true;
  isAuthenticated = false;

  ngOnInit(): void {
    if (this.isAuth0Configured) {
      combineLatest([
        this.authService.isLoading$,
        this.authService.isAuthenticated$
      ]).pipe(
        filter(([isLoading]) => !isLoading),
        take(1),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(([_, isAuthenticated]) => {
        this.isAuthenticated = isAuthenticated;
        this.isLoading = false;
        
        if (isAuthenticated) {
          this.router.navigate(['/admin/bookings']);
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  proceedAsGuest(): void {
    this.router.navigate(['/guest/book']);
  }

  login(): void {
    this.authService.loginWithRedirect({
      appState: { target: '/admin/bookings' },
    });
  }
}
