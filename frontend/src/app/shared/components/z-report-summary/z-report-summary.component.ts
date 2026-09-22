import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZReportData } from '../../models/reports.model';
import { formatPaymentMethodLabel, formatSignedCurrency } from '../../utils/payment-method-format.util';

/** Renders a Z-report's per-employee accordion + grand totals — shared by the "just created"
 *  result screen and the historical detail view, since both show the exact same data shape. */
@Component({
  selector: 'app-z-report-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './z-report-summary.component.html',
  styleUrl: './z-report-summary.component.scss',
})
export class ZReportSummaryComponent {
  @Input({ required: true }) data!: ZReportData;

  private expandedUserIds = new Set<string>();

  formatMethod = formatPaymentMethodLabel;
  formatAmount = formatSignedCurrency;

  isExpanded(userId: string): boolean {
    return this.expandedUserIds.has(userId);
  }

  toggleExpanded(userId: string): void {
    if (this.expandedUserIds.has(userId)) {
      this.expandedUserIds.delete(userId);
    } else {
      this.expandedUserIds.add(userId);
    }
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
}
