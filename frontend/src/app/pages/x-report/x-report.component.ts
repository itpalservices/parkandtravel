import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { XReportData, XReportTransaction } from '../../shared/models/reports.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-x-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './x-report.component.html',
  styleUrl: './x-report.component.scss',
})
export class XReportComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  loading = false;
  exporting = false;
  data: XReportData | null = null;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.apiService.get<XReportData>('/reports/x-report').subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get totalCash(): number {
    return this.data?.totals['cash'] ?? 0;
  }

  get totalCard(): number {
    return this.data?.totals['card'] ?? 0;
  }

  get grandTotal(): number {
    return Object.values(this.data?.totals ?? {}).reduce((s, v) => s + v, 0);
  }

  get transactions(): XReportTransaction[] {
    return this.data?.transactions ?? [];
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  goBack(): void {
    this.router.navigate(['/admin/bookings']);
  }

  exportPDF(): void {
    if (!this.data || this.transactions.length === 0) return;
    this.exporting = true;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 107, 143);
    const title = 'X Report — Unreported Transactions';
    doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const dateText = `Generated: ${new Date().toLocaleString('en-GB')}`;
    doc.text(dateText, (pageWidth - doc.getTextWidth(dateText)) / 2, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Cash: €${this.totalCash.toFixed(2)}   Card: €${this.totalCard.toFixed(2)}   Total: €${this.grandTotal.toFixed(2)}`, 14, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Plate No', 'Type', 'Payment', 'Amount (€)']],
      body: this.transactions.map(t => [
        this.formatDate(t.datetime),
        t.plateNo || '-',
        t.type === 'checkin' ? 'Check-in' : 'Check-out',
        t.paymentMethod,
        Number(t.amount).toFixed(2),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 107, 143], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 10, right: 10 },
    });

    doc.save(`x-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    this.exporting = false;
  }
}
