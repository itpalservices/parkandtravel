import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import { ZReportData, XReportTransaction } from '../../../shared/models/reports.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToExcel } from '../../../shared/utils/excel-export.util';

const REPORT_COLUMNS = ['Date', 'Plate No', 'Type', 'Payment', 'Amount (€)'];

@Component({
  selector: 'app-z-report-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbDropdownModule],
  templateUrl: './z-report-detail.component.html',
  styleUrl: './z-report-detail.component.scss',
})
export class ZReportDetailComponent implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);

  loading = false;
  exporting = false;
  report: ZReportData | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.loading = true;
    this.apiService.get<ZReportData>(`/reports/z-report-new/${id}`).subscribe({
      next: (data) => {
        this.report = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get transactions(): XReportTransaction[] {
    return this.report?.transactions ?? [];
  }

  get cashDiff(): number {
    if (!this.report) return 0;
    return parseFloat((this.report.declaredCash - this.report.actualCash).toFixed(2));
  }

  get cardDiff(): number {
    if (!this.report) return 0;
    return parseFloat((this.report.declaredCard - this.report.actualCard).toFixed(2));
  }

  get totalDiff(): number {
    return parseFloat((this.cashDiff + this.cardDiff).toFixed(2));
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  diffLabel(diff: number): string {
    if (diff === 0) return 'Match';
    return diff > 0 ? `+€${diff.toFixed(2)} surplus` : `-€${Math.abs(diff).toFixed(2)} shortage`;
  }

  diffClass(diff: number): string {
    if (diff === 0) return 'match';
    return diff > 0 ? 'surplus' : 'shortage';
  }

  exportPDF(): void {
    if (!this.report) return;
    this.exporting = true;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 107, 143);
    const title = 'Z Report';
    doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const sub = `Employee: ${this.report.targetUserName}   |   Run by: ${this.report.runByUserName}   |   ${this.formatDateTime(this.report.createdAt)}`;
    doc.text(sub, (pageWidth - doc.getTextWidth(sub)) / 2, y);
    y += 12;

    autoTable(doc, {
      startY: y,
      head: [['', 'Declared', 'Actual', 'Difference']],
      body: [
        ['Cash', `€${this.report.declaredCash.toFixed(2)}`, `€${this.report.actualCash.toFixed(2)}`, this.diffLabel(this.cashDiff)],
        ['Card', `€${this.report.declaredCard.toFixed(2)}`, `€${this.report.actualCard.toFixed(2)}`, this.diffLabel(this.cardDiff)],
        ['Total', `€${(this.report.declaredCash + this.report.declaredCard).toFixed(2)}`, `€${(this.report.actualCash + this.report.actualCard).toFixed(2)}`, this.diffLabel(this.totalDiff)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 107, 143], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Transactions', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Plate No', 'Type', 'Payment', 'Amount (€)']],
      body: this.transactions.map(t => [
        this.formatDateTime(t.datetime),
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

    doc.save(`z-report-${this.report.targetUserName.replace(/\s+/g, '-')}-${new Date(this.report.createdAt).toISOString().slice(0, 10)}.pdf`);
    this.exporting = false;
  }

  async exportExcel(): Promise<void> {
    if (!this.report || this.exporting) return;
    this.exporting = true;
    try {
      const totalDeclared = this.report.declaredCash + this.report.declaredCard;
      const totalActual = this.report.actualCash + this.report.actualCard;

      await exportToExcel({
        fileName: `z-report-${this.report.targetUserName.replace(/\s+/g, '-')}-${new Date(this.report.createdAt).toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Z-Report',
        title: 'Z Report',
        infoLines: [
          `Employee: ${this.report.targetUserName}   |   Run by: ${this.report.runByUserName}   |   ${this.formatDateTime(this.report.createdAt)}`,
          `Cash: Declared €${this.report.declaredCash.toFixed(2)} | Actual €${this.report.actualCash.toFixed(2)} | ${this.diffLabel(this.cashDiff)}`,
          `Card: Declared €${this.report.declaredCard.toFixed(2)} | Actual €${this.report.actualCard.toFixed(2)} | ${this.diffLabel(this.cardDiff)}`,
          `Total: Declared €${totalDeclared.toFixed(2)} | Actual €${totalActual.toFixed(2)} | ${this.diffLabel(this.totalDiff)}`,
        ],
        columns: REPORT_COLUMNS,
        rows: this.transactions.map(t => [
          this.formatDateTime(t.datetime),
          t.plateNo || '-',
          t.type === 'checkin' ? 'Check-in' : 'Check-out',
          t.paymentMethod,
          Number(t.amount).toFixed(2),
        ]),
      });
    } finally {
      this.exporting = false;
    }
  }
}
