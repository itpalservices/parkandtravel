import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '@auth0/auth0-angular';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Output() toggleSidebar = new EventEmitter<void>();
  
  private authService = environment.auth0.domain && environment.auth0.clientId 
    ? inject(AuthService, { optional: true }) 
    : null;
  
  user$: Observable<User | null | undefined> = this.authService?.user$ || of(null);

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
