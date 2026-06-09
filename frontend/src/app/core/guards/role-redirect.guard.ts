import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
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
