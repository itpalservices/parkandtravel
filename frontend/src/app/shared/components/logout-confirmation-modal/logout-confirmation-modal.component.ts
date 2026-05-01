import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../../../../environments/environment';
import { LogoutConfirmationService } from '../../../core/services/logout-confirmation.service';
import { ShiftService } from '../../../core/services/shift.service';
import { LogoutConfirmationState, ShiftTotals } from '../../models/shifts.model';

@Component({
  selector: 'app-logout-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logout-confirmation-modal.component.html',
  styleUrls: ['./logout-confirmation-modal.component.scss']
})
export class LogoutConfirmationModalComponent implements OnInit, OnDestroy {
  private logoutConfirmationService = inject(LogoutConfirmationService);
  private shiftService = inject(ShiftService);
  private authService = environment.auth0.domain && environment.auth0.clientId
    ? inject(AuthService, { optional: true })
    : null;

  state: LogoutConfirmationState = { visible: false, loading: false, summary: null };
  isLoggingOut = false;

  private sub!: Subscription;

  ngOnInit(): void {
    this.sub = this.logoutConfirmationService.state$.subscribe(s => {
      this.state = s;
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get grandTotal(): number {
    return this.state.summary?.totals.reduce((sum, t: ShiftTotals) => sum + t.total, 0) ?? 0;
  }

  formatMethod(method: string): string {
    return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  }

  cancel(): void {
    this.logoutConfirmationService.hide();
  }

  async confirmLogout(): Promise<void> {
    if (!this.authService) return;
    this.isLoggingOut = true;
    await this.shiftService.endShift();
    this.logoutConfirmationService.hide();
    this.authService.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
