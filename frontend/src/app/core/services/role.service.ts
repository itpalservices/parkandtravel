import { Injectable, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type UserRole = 'admin' | 'driver' | 'user';

export interface UserRoleInfo {
  role: UserRole;
  isAdmin: boolean;
  isDriver: boolean;
  isUser: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private authService = inject(AuthService);
  private roleNamespace = 'https://park-and-travel/roles';

  private userRole$: Observable<UserRoleInfo> | null = null;

  getUserRole(): Observable<UserRoleInfo> {
    if (!environment.auth0.domain || !environment.auth0.clientId) {
      return of(this.createRoleInfo('user'));
    }

    if (!this.userRole$) {
      this.userRole$ = this.authService.user$.pipe(
        map(user => {
          if (!user) {
            return this.createRoleInfo('user');
          }

          const role = this.extractRoleFromUser(user);
          return this.createRoleInfo(role);
        }),
        catchError(() => of(this.createRoleInfo('user'))),
        shareReplay(1)
      );
    }

    return this.userRole$;
  }

  private extractRoleFromUser(user: any): UserRole {
    const roles = user[this.roleNamespace];
    
    if (Array.isArray(roles) && roles.length > 0) {
      const role = roles[0].toLowerCase();
      if (role === 'admin' || role === 'driver' || role === 'user') {
        return role;
      }
    }

    if (typeof roles === 'string') {
      const role = roles.toLowerCase();
      if (role === 'admin' || role === 'driver' || role === 'user') {
        return role;
      }
    }

    const appMetadata = user['https://park-and-travel/app_metadata'] || user.app_metadata;
    if (appMetadata?.role) {
      const role = appMetadata.role.toLowerCase();
      if (role === 'admin' || role === 'driver' || role === 'user') {
        return role;
      }
    }

    return 'user';
  }

  private createRoleInfo(role: UserRole): UserRoleInfo {
    return {
      role,
      isAdmin: role === 'admin',
      isDriver: role === 'driver',
      isUser: role === 'user'
    };
  }

  clearCache(): void {
    this.userRole$ = null;
  }
}
