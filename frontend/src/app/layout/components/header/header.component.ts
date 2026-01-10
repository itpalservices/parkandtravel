import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '@auth0/auth0-angular';
import { Observable, of, map, combineLatest } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserProfileService, UserProfileData } from '../../../core/services/user-profile.service';

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
    if (this.authService) {
      this.authService.logout({
        logoutParams: {
          returnTo: window.location.origin
        }
      });
    }
  }
}
