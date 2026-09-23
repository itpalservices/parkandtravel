import { inject } from '@angular/core';
import { Router, CanActivateFn, CanActivateChildFn } from '@angular/router';
import { RoleService } from '../services/role.service';
import { map, take } from 'rxjs/operators';

export const adminOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);
  const roleService = inject(RoleService);

  return roleService.getUserRole().pipe(
    take(1),
    map(roleInfo => {
      if (roleInfo.isAdmin) {
        return true;
      }
      router.navigate(['/admin/bookings']);
      return false;
    })
  );
};

export const adminOrDriverOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);
  const roleService = inject(RoleService);

  return roleService.getUserRole().pipe(
    take(1),
    map(roleInfo => {
      if (roleInfo.isAdmin || roleInfo.isDriver) {
        return true;
      }
      router.navigate(['/admin/bookings']);
      return false;
    })
  );
};

export const UNDELIVERED_RECEIPTS_ROUTE = '/admin/undelivered-receipts';

export const superAdminOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);
  const roleService = inject(RoleService);

  return roleService.getUserRole().pipe(
    take(1),
    map(roleInfo => roleInfo.isSuperAdmin ? true : router.createUrlTree(['/admin/bookings']))
  );
};

/** super_admin is confined to the Undelivered Receipts page — any other /admin child route
 *  (bookings, profile, reports, the '' redirect…) sends it back there. */
export const superAdminRestrictionGuard: CanActivateChildFn = (_route, state) => {
  const router = inject(Router);
  const roleService = inject(RoleService);

  return roleService.getUserRole().pipe(
    take(1),
    map(roleInfo => {
      if (!roleInfo.isSuperAdmin || state.url.startsWith(UNDELIVERED_RECEIPTS_ROUTE)) {
        return true;
      }
      return router.createUrlTree([UNDELIVERED_RECEIPTS_ROUTE]);
    })
  );
};
