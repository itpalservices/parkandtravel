import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';

export interface UserProfileData {
  name: string;
  surname: string;
  picture?: string;
  emailVerified: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  private authService = environment.auth0.domain && environment.auth0.clientId 
    ? inject(AuthService, { optional: true }) 
    : null;

  private profileSubject = new BehaviorSubject<UserProfileData | null>(null);
  profile$: Observable<UserProfileData | null> = this.profileSubject.asObservable();

  constructor() {
    this.authService?.user$.subscribe(user => {
      if (user) {
        const nameParts = (user.name || '').split(' ');
        this.profileSubject.next({
          name: nameParts[0] || '',
          surname: nameParts.slice(1).join(' ') || '',
          picture: user.picture,
          emailVerified: user.email_verified === true
        });
      }
    });
  }

  updateProfile(data: Partial<UserProfileData>): void {
    const current = this.profileSubject.value;
    if (current) {
      this.profileSubject.next({ ...current, ...data });
    } else {
      this.profileSubject.next({
        name: data.name || '',
        surname: data.surname || '',
        picture: data.picture,
        emailVerified: data.emailVerified ?? false
      });
    }
  }

  getDisplayName(): string {
    const profile = this.profileSubject.value;
    if (!profile) return '';
    return `${profile.name} ${profile.surname}`.trim();
  }
}
