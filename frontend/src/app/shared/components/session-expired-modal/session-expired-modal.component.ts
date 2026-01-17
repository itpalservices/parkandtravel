import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@auth0/auth0-angular';
import { SessionService } from '../../../core/services/session.service';

@Component({
  selector: 'app-session-expired-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="visible">
      <div class="modal-container">
        <div class="modal-content">
          <div class="modal-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h2 class="modal-title">Session Expired</h2>
          <p class="modal-message">You have to log in again</p>
          <button class="btn-logout" (click)="logout()">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Log Out
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
    }

    .modal-container {
      background: #ffffff;
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
    }

    .modal-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .modal-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background-color: #fef3c7;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #d97706;
      margin-bottom: 0.5rem;
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0;
    }

    .modal-message {
      font-size: 1rem;
      color: #6b7280;
      margin: 0 0 1rem 0;
    }

    .btn-logout {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.875rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      color: #ffffff;
      background-color: #006B8F;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .btn-logout:hover {
      background-color: #005a78;
    }

    .btn-logout:active {
      transform: scale(0.98);
    }
  `]
})
export class SessionExpiredModalComponent {
  visible = false;
  
  private auth = inject(AuthService);
  private sessionService = inject(SessionService);

  constructor() {
    this.sessionService.sessionExpired$.subscribe(expired => {
      this.visible = expired;
    });
  }

  logout(): void {
    this.sessionService.resetSession();
    this.auth.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  }
}
