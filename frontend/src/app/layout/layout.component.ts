import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { filter, take } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { environment } from '../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  sidebarOpen = signal(false);

  ngOnInit(): void {
    this.checkEmailVerification();
  }

  private checkEmailVerification(): void {
    if (!environment.auth0.domain || !environment.auth0.clientId) {
      return;
    }

    this.authService.isLoading$.pipe(
      filter(loading => !loading),
      take(1)
    ).subscribe(() => {
      this.authService.user$.pipe(take(1)).subscribe(user => {
        if (user && user.email_verified === false) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'Email not verified',
            html: 'Please verify your email. <a id="profile-link" href="javascript:void(0)" style="color: #006B8F; font-weight: 500; text-decoration: underline; cursor: pointer;">Go to Profile</a>',
            showConfirmButton: false,
            timer: 6000,
            timerProgressBar: true,
            didOpen: () => {
              const link = document.getElementById('profile-link');
              if (link) {
                link.addEventListener('click', () => {
                  Swal.close();
                  this.router.navigate(['/admin/user-profile']);
                });
              }
            }
          });
        }
      });
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
