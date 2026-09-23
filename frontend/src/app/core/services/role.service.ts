import { Injectable, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type UserRole = 'admin' | 'driver' | 'user' | 'super_admin';

const KNOWN_ROLES: UserRole[] = ['admin', 'driver', 'user', 'super_admin'];

export interface UserRoleInfo {
  role: UserRole;
  isAdmin: boolean;
  isDriver: boolean;
  isUser: boolean;
  /** Restricted role: sees only the Undelivered Receipts page. */
  isSuperAdmin: boolean;
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
    
    const claimed = Array.isArray(roles) ? roles[0] : roles;
    const fromClaim = this.toKnownRole(claimed);
    if (fromClaim) return fromClaim;

    const appMetadata = user['https://park-and-travel/app_metadata'] || user.app_metadata;
    return this.toKnownRole(appMetadata?.role) ?? 'user';
  }

  private toKnownRole(value: unknown): UserRole | null {
    if (typeof value !== 'string') return null;
    const role = value.toLowerCase() as UserRole;
    return KNOWN_ROLES.includes(role) ? role : null;
  }

  private createRoleInfo(role: UserRole): UserRoleInfo {
    return {
      role,
      isAdmin: role === 'admin',
      isDriver: role === 'driver',
      isUser: role === 'user',
      isSuperAdmin: role === 'super_admin',
    };
  }

  clearCache(): void {
    this.userRole$ = null;
  }
}
