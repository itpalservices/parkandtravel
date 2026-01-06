import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleService } from '../../core/services/role.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-admin-redirect',
  standalone: true,
  template: '<div class="loading">Loading...</div>',
  styles: ['.loading { display: flex; justify-content: center; align-items: center; height: 100vh; }']
})
export class AdminRedirectComponent implements OnInit {
  private router = inject(Router);
  private roleService = inject(RoleService);

  ngOnInit(): void {
    this.roleService.getUserRole().pipe(take(1)).subscribe(roleInfo => {
      if (roleInfo.isAdmin) {
        this.router.navigate(['/admin/dashboard'], { replaceUrl: true });
      } else {
        this.router.navigate(['/admin/bookings'], { replaceUrl: true });
      }
    });
  }
}
