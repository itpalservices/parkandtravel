import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../../core/services/api.service';
import { CardType, DashboardDetailItem, DashboardSortDirection, DashboardSortField } from '../../../shared/models/dashboard.model';
import { buildTelHref } from '../../../shared/utils/phone.util';

@Component({
  selector: 'app-dashboard-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-details.component.html',
  styleUrl: './dashboard-details.component.scss'
})
export class DashboardDetailsComponent implements OnInit {
  private apiService = inject(ApiService);
  public activeModal = inject(NgbActiveModal);

  @Input() cardType!: CardType;
  @Input() cardTitle!: string;

  allItems: DashboardDetailItem[] = [];
  filteredItems: DashboardDetailItem[] = [];
  displayedItems: DashboardDetailItem[] = [];

  loading = true;
  searchTerm = '';
  page = 1;
  pageSize = 20;
  totalPages = 1;
  pageNumbers: number[] = [];
  showParkPlace = true;

  sortField: DashboardSortField | null = null;
  sortDirection: DashboardSortDirection = 'asc';

  private cardTitles: Record<CardType, string> = {
    'total-cars': 'Total Cars',
    'today-check-ins': 'Today Check-In',
    'today-check-outs': 'Today Check-Out',
    'wash-today': 'Cars for Wash Today',
    'wash-tomorrow': 'Cars for Wash Tomorrow'
  };

  ngOnInit(): void {
    if (!this.cardTitle) {
      this.cardTitle = this.cardTitles[this.cardType] || 'Details';
    }
    this.showParkPlace = this.cardType !== 'today-check-ins';
    this.loadDetails();
  }

  private loadDetails(): void {
    this.loading = true;
    this.apiService.get<DashboardDetailItem[]>(`/dashboard/card-details?cardType=${this.cardType}`).subscribe({
      next: (items) => {
        this.allItems = items;
        this.filterAndPaginate();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading card details:', err);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.page = 1;
    this.filterAndPaginate();
  }

  private filterAndPaginate(): void {
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      this.filteredItems = this.allItems.filter(item =>
        item.customerName.toLowerCase().includes(term) ||
        item.plateNo.toLowerCase().includes(term) ||
        item.vehicleModel.toLowerCase().includes(term) ||
        item.checkIn.toLowerCase().includes(term) ||
        item.checkOut.toLowerCase().includes(term) ||
        item.phoneNumber.includes(term)
      );
    } else {
      this.filteredItems = [...this.allItems];
    }

    if (this.sortField) {
      const field = this.sortField;
      this.filteredItems = [...this.filteredItems].sort((a, b) => this.compareItems(a, b, field, this.sortDirection));
    }

    this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize);
    this.calculatePageNumbers();
    this.updateDisplayedItems();
  }

  onSortClick(field: DashboardSortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.filterAndPaginate();
  }

  sortIndicator(field: DashboardSortField): string {
    if (this.sortField !== field) return '';
    return this.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  private compareItems(a: DashboardDetailItem, b: DashboardDetailItem, field: DashboardSortField, direction: DashboardSortDirection): number {
    switch (field) {
      case 'customerName': return this.compareStrings(a.customerName, b.customerName, direction);
      case 'plateNo': return this.compareStrings(a.plateNo, b.plateNo, direction);
      case 'vehicleModel': return this.compareStrings(a.vehicleModel, b.vehicleModel, direction);
      case 'parkPlace': return this.compareStrings(a.parkPlace ?? '', b.parkPlace ?? '', direction);
      case 'checkIn': return this.compareDateStrings(a.checkIn, b.checkIn, direction);
      case 'checkOut': return this.compareDateStrings(a.checkOut, b.checkOut, direction);
    }
  }

  /** Empty values always sort last, regardless of direction. */
  private compareStrings(a: string, b: string, direction: DashboardSortDirection): number {
    const aEmpty = !a.trim();
    const bEmpty = !b.trim();
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
    return direction === 'desc' ? -result : result;
  }

  /** checkIn/checkOut arrive as pre-formatted "DD/MM/YYYY HH:mm" display strings, not raw
   *  ISO dates, so a plain string compare would sort them wrong (day-first, not year-first) —
   *  parse back into a timestamp for the comparison only. */
  private compareDateStrings(a: string, b: string, direction: DashboardSortDirection): number {
    const aEmpty = !a;
    const bEmpty = !b;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const result = this.parseDisplayDateTime(a) - this.parseDisplayDateTime(b);
    return direction === 'desc' ? -result : result;
  }

  private parseDisplayDateTime(value: string): number {
    const [datePart, timePart] = value.split(' ');
    const [day, month, year] = (datePart || '').split('/').map(Number);
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
    if (!day || !month || !year) return 0;
    return new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();
  }

  getTelHref(item: DashboardDetailItem): string | null {
    return buildTelHref(item.phoneCode, item.phoneNumber);
  }

  private updateDisplayedItems(): void {
    const startIndex = (this.page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedItems = this.filteredItems.slice(startIndex, endIndex);
  }

  private calculatePageNumbers(): void {
    this.pageNumbers = [];
    const maxPagesToShow = 5;

    if (this.totalPages <= maxPagesToShow) {
      for (let i = 1; i <= this.totalPages; i++) {
        this.pageNumbers.push(i);
      }
    } else {
      this.pageNumbers.push(1);

      let startPage = Math.max(2, this.page - 1);
      let endPage = Math.min(this.totalPages - 1, this.page + 1);

      if (this.page <= 3) {
        endPage = 4;
      }
      if (this.page >= this.totalPages - 2) {
        startPage = this.totalPages - 3;
      }

      if (startPage > 2) {
        this.pageNumbers.push(-1);
      }

      for (let i = startPage; i <= endPage; i++) {
        this.pageNumbers.push(i);
      }

      if (endPage < this.totalPages - 1) {
        this.pageNumbers.push(-1);
      }

      this.pageNumbers.push(this.totalPages);
    }
  }

  onPageClick(pageNum: number): void {
    if (pageNum !== this.page && pageNum >= 1 && pageNum <= this.totalPages) {
      this.page = pageNum;
      this.calculatePageNumbers();
      this.updateDisplayedItems();
    }
  }

  onPreviousPage(): void {
    if (this.page > 1) {
      this.page--;
      this.calculatePageNumbers();
      this.updateDisplayedItems();
    }
  }

  onNextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.calculatePageNumbers();
      this.updateDisplayedItems();
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
