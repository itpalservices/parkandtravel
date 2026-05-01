import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '@auth0/auth0-angular';
import { Observable, of, map, combineLatest, take } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { UserProfileService, UserProfileData } from '../../../core/services/user-profile.service';
import { ShiftService } from '../../../core/services/shift.service';
import { RoleService } from '../../../core/services/role.service';
import { LogoutConfirmationService } from '../../../core/services/logout-confirmation.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Output() toggleSidebar = new EventEmitter<void>();
  
  private authService = environment.auth0.domain && environment.auth0.clientId
    ? inject(AuthService, { optional: true })
    : null;
  private userProfileService = inject(UserProfileService);
  private shiftService = inject(ShiftService);
  private roleService = inject(RoleService);
  private logoutConfirmationService = inject(LogoutConfirmationService);
  
  user$: Observable<User | null | undefined> = this.authService?.user$ || of(null);
  profile$: Observable<UserProfileData | null> = this.userProfileService.profile$;
  
  displayName$: Observable<string> = combineLatest([this.user$, this.profile$]).pipe(
    map(([user, profile]) => {
      if (profile && (profile.name || profile.surname)) {
        return `${profile.name} ${profile.surname}`.trim();
      }
      return user?.name || '';
    })
  );
  
  emailVerified$: Observable<boolean> = this.profile$.pipe(
    map(profile => profile?.emailVerified === true)
  );

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  logout(): void {
    if (!this.authService) return;

    this.roleService.getUserRole().pipe(take(1)).subscribe((roleInfo) => {
      if (roleInfo.isAdmin || roleInfo.isDriver) {
        this.logoutConfirmationService.show();
        this.shiftService.getShiftSummary().pipe(
          catchError(() => of({ shiftId: null, transactions: [], totals: [] }))
        ).subscribe((summary) => {
          if (summary.shiftId === null) {
            this.logoutConfirmationService.hide();
            this.authService!.logout({ logoutParams: { returnTo: window.location.origin } });
          } else {
            this.logoutConfirmationService.setSummary(summary);
          }
        });
      } else {
        this.authService!.logout({ logoutParams: { returnTo: window.location.origin } });
      }
    });
  }
}
