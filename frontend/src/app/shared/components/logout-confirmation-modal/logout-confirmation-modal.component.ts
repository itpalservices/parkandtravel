import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../../../../environments/environment';
import { LogoutConfirmationService } from '../../../core/services/logout-confirmation.service';
import { ShiftService } from '../../../core/services/shift.service';
import { ZebraPrintService } from '../../../core/services/zebra-print.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { LogoutConfirmationState, ShiftTotals } from '../../models/shifts.model';
import { formatPaymentMethodLabel, formatSignedCurrency } from '../../utils/payment-method-format.util';

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
  private zebraPrintService = inject(ZebraPrintService);
  private userProfileService = inject(UserProfileService);
  private authService = environment.auth0.domain && environment.auth0.clientId
    ? inject(AuthService, { optional: true })
    : null;

  state: LogoutConfirmationState = { visible: false, loading: false, summary: null };
  isLoggingOut = false;
  isPrinting = false;
  printError: string | null = null;

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

  formatMethod = formatPaymentMethodLabel;
  formatAmount = formatSignedCurrency;

  cancel(): void {
    this.printError = null;
    this.logoutConfirmationService.hide();
  }

  /** Printing the shift summary is the staff member's proof of what they collected —
   *  the shift must not be closed (and they must not be logged out) unless it actually
   *  printed, so a failed print aborts here and leaves the shift open for a retry. */
  async closeShiftAndLogout(): Promise<void> {
    if (!this.authService || this.isLoggingOut) return;
    this.printError = null;
    this.isPrinting = true;
    try {
      const cashierName = this.userProfileService.getDisplayName() || '';
      await this.zebraPrintService.printShiftSummary(cashierName);
    } catch (err: any) {
      this.isPrinting = false;
      this.printError = err?.message || 'Could not print the shift summary. Please check the printer and try again.';
      return;
    }
    this.isPrinting = false;
    this.isLoggingOut = true;
    await this.shiftService.endShift();
    this.logoutConfirmationService.hide();
    this.authService.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  /** Logs out without closing the shift — it stays open and is picked back up automatically
   *  on the next login (shift start reuses whatever's still open for that user). */
  logoutOnly(): void {
    if (!this.authService || this.isLoggingOut) return;
    this.printError = null;
    this.isLoggingOut = true;
    this.logoutConfirmationService.hide();
    this.authService.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
