import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RoleService } from '../../core/services/role.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-admin-redirect',
  standalone: true,
  template: `
    <div class="loading">
      <div class="spinner"></div>
    </div>
  `,
  styles: [`
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 50vh;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top-color: var(--primary-color, #006B8F);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
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
